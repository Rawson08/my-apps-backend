const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mailgun = require("mailgun-js");
const DOMAIN = "mg.roshansubedi.me";
const mg = mailgun({ apiKey: process.env.MAILGUN_API_KEY, domain:DOMAIN });
const EMAILNAME = "Roshan's AppHub";

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY;

// Sign up route
router.post("/signup", async (req, res) => {
    const { username, email, firstname, lastname, password } = req.body;
    try {
        // Check if user already exists
        const existingUser = await User.findOne({ username });
        const existingEmail = await User.findOne({ email })
        if (existingEmail) {
          return res.status(400).json({ message: "Email already used! Please reset password."} );
        }
        if (existingUser) {
            return res.status(400).json({ message: "Username taken. Please try another username." });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        const newUser = new User({ username, email, firstname, lastname,
           password: hashedPassword, isVerified:false, verificationCode,
            verificationExpires: new Date(Date.now() + 15*60*1000),  //Expires in 15 mins
          });

          const emailData = {
            from: `${EMAILNAME} <noreply@${DOMAIN}>`,
            to: email,
            subject: "Verify your email | Roshan's AppHub",
            text: `Hi ${firstname},\n\nYour verification code is: ${verificationCode}\n\nIt will expire in 15 minutes. Please request a new code if it expires.\n\nThank you!`,
          }
        await mg.messages().send(emailData);

        await newUser.save();
        res.status(201).json({ message: "Signup successful! Please verify your email.", redirect: "email-verify.html" });
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: "Error registering user", error });
    }
});

router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;

  try {
    const user = await User.findOne({ email });

    if(!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if(user.isVerified){
      return res.status(400).json({ message: "User is already verified." });
    }

    if(user.verificationCode !== code){
      return res.status(400).json({ message: "Invalid verification code!" });
    }

    if(user.verificationExpires && user.verificationExpires < Date.now()) {
      return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
    }

    user.isVerified = true;
    user.verificationCode = null;
    user.verificationExpires = null;
    await user.save();

    res.status(200).json({ message: "Email verified successfully!" });
  } catch (error) {
    console.error("Error verifying email:", error);
    res.status(500).json({ message: "Error verifying email.", error });
  }
});

router.post("/resend-code", async (req, res) => {
  const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: "User is already verified." });
        }

        // Generate a new code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = verificationCode;
        user.verificationExpires = new Date(Date.now() + 15 * 60 * 1000); // Expires in 15 mins
        await user.save();

        // Send the new code via email
        await mg.messages().send({
            from: `Roshan's AppHub <noreply@${DOMAIN}>`,
            to: email,
            subject: "Your New Verification Code | Roshan's AppHub",
            text: `Hi,\n\nYour new verification code is: ${verificationCode}\n\nIt will expire in 15 minutes.\n\nThank you!`,
        });

        res.status(200).json({ message: "Verification code resent." });
    } catch (error) {
        console.error("Error resending code:", error);
        res.status(500).json({ message: "Error resending code.", error });
    }
});


router.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        // Check if user exists
        const user = await User.findOne({ username });
        console.log("User is:${user}", user);
        if (!user) {
            return res.status(400).json({ message: "Invalid username or password" });
        }

        // Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid username or password" });
        }

        if (!user.isVerified) {
          return res.status(403).json({ message: "Email not verified", redirect: "email-verify.html", email: user.email });
        }

        // Generate JWT
        const token = jwt.sign({ id: user._id }, SECRET_KEY, { expiresIn: "1h" });
        res.status(200).json({ message: "Login successful", token });
    } catch (error) {
        res.status(500).json({ message: "Error logging in. Please try again.", error });
    }
});

router.get("/user-info", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token not provided or invalid" });
    }
  
    try {
      const decoded = jwt.verify(token, SECRET_KEY); // Decode the token
      const user = await User.findById(decoded.id); // Fetch the user from the database
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      res.status(200).json({ userId: user._id, username: user.username, firstname: user.firstname }); // Include username
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token expired" });
          } else if (error.name === "JsonWebTokenError") {
            return res.status(401).json({ message: "Invalid token" });
          } else {
            console.error("Unexpected error:", error);
            res.status(500).json({ message: "Internal server error" });
          }
    }
  });

  router.post("/reset-username", async (req, res) => {
    const { email } = req.body;

    if(!email){
        return res.status(400).json({ message: "Email is required." });
    }

    try {
        const user = await User.findOne({ email });

        const emailData = {
            from: `${EMAILNAME} <noreply@${DOMAIN}>`, to: email, subject: `Your requested username for Roshan's AppHun Login`,
            text: `Hello ${user.firstname},\n\nYou made a request for your username. It is ${user.username}\n\nIf you did not make this request, we suggest to secure your account by changing your password or email address.\n\nThank you!`,
        };

        await mg.messages().send(emailData);

        res.status(200).json({ message: `If there is an account associated with ${email}, the username has been sent to that address. Please check your email app.` });
    } catch (error) {
        console.error("Error during reset username:", error);
        res.status(500).json({ message: "An error occured. Please try again later." });
    }
  });

  router.post("/reset-password-request", async (req, res) => {
    const { username, email } = req.body;

    if(!username || !email) {
        return res.status(400).json({ message: "Please enter both field." });
    }

    try {
        const user = await User.findOne({ username, email });
        if(!user) {
            return res.status(404).json({ message: "User not found with the provided information." });
        }

        const token = jwt.sign({ id: user._id }, SECRET_KEY, { expiresIn: "15m" });

        const resetLink = `https://roshansubedi.me/my-apps/reset-password-confirm.html?token=${token}`;

        const emailData = {
            from: `${EMAILNAME} <noreply@${DOMAIN}>`, to: user.email,
            subject: "Reset your Password",
            html:`
            <p>Hi ${user.firstname},</p>
        <p>You requested to reset your password. Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        `,
        };

        await mg.messages().send(emailData);
        res.status(200).json({ message: "Password reset link sent successfully." });
    } catch (error) {
        console.error("Error processing reset password request:", error);
        res.status(500).json({ message: "Error processing request." });
    }
  });

  router.post("/reset-password-confirm", async (req, res) => {
    const { token, newPassword } = req.body;
  
    try {
      // Verify the token
      const decoded = jwt.verify(token, SECRET_KEY);
      const userId = decoded.id;
  
      // Find the user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "Invalid token or user does not exist." });
      }
  
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
  
      // Update the user's password
      user.password = hashedPassword;
      await user.save();
  
      res.status(200).json({ message: "Password reset successfully." });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(400).json({ message: "Invalid or expired token." });
    }
  });
  
  router.post("/update-password", async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers.authorization?.split(" ")[1];
  
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      const user = await User.findById(decoded.id);
  
      if (!user) return res.status(404).json({ message: "User not found." });
  
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: "Current password is incorrect." });
  
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
  
      res.status(200).json({ message: "Password updated successfully." });
    } catch (error) {
      console.error("Error updating password:", error);
      res.status(500).json({ message: "Error updating password." });
    }
  });

  router.post("/update-email", async (req, res) => {
    const { newEmail } = req.body;
    const token = req.headers.authorization?.split(" ")[1];
  
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      const user = await User.findById(decoded.id);
  
      if (!user) return res.status(404).json({ message: "User not found." });
  
      user.email = newEmail;
      user.isVerified = false;
      user.verificationExpires = new Date(Date.now() + 15*60*1000);
      user.verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const emailData = {
        from: `${EMAILNAME} <noreply@${DOMAIN}>`,
        to: user.email,
        subject: "Verify your email | Roshan's AppHub",
        text: `Hi ${user.firstname},\n\nYour verification code is: ${user.verificationCode}\n\nIt will expire in 15 minutes. Please request a new code if it expires.\n\nThank you!`,
      }
        await mg.messages().send(emailData);
      await user.save();
      res.status(200).json({ message: "Email updated successfully." });
    } catch (error) {
      console.error("Error updating email:", error);
      res.status(500).json({ message: "Error updating email." });
    }
  });
  
  router.delete("/delete-account", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
  
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      const user = await User.findById(decoded.id);
  
      if (!user) return res.status(404).json({ message: "User not found." });
  
      await User.deleteOne({ _id: decoded.id }); // Delete user from database
  
      res.status(200).json({ message: "Account deleted successfully." });
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Error deleting account." });
    }
  });
  
  router.post("/update-profile", async (req, res) => {
    const { firstname, lastname } = req.body;
    const token = req.headers.authorization?.split(" ")[1];
  
    if (!firstname || !lastname) {
      return res.status(400).json({ message: "First name and last name are required." });
    }
  
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      const userId = decoded.id;
  
      // Find and update the user
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
  
      user.firstname = firstname;
      user.lastname = lastname;
      await user.save();
  
      res.status(200).json({ message: "Profile updated successfully." });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(400).json({ message: "Invalid or expired token." });
    }
  });
  

module.exports = router;
