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
      // 🔹 Check if username or email already exists
      const existingUser = await User.findOne({ where: { username } });
      const existingEmail = await User.findOne({ where: { email } });

      if (existingEmail) {
          return res.status(400).json({ message: "Email already used! Please reset password." });
      }
      if (existingUser) {
          return res.status(400).json({ message: "Username taken. Please try another username." });
      }

      // 🔹 Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // 🔹 Create new user in PostgreSQL
      const newUser = await User.create({
          username,
          email,
          firstname,
          lastname,
          password: hashedPassword,
          isVerified: false,
          verificationCode,
          verificationExpires: new Date(Date.now() + 15 * 60 * 1000), // Expires in 15 mins
      });

      // 🔹 Send verification email
      const emailData = {
          from: `${EMAILNAME} <noreply@${DOMAIN}>`,
          to: email,
          subject: "Verify your email | Roshan's AppHub",
          text: `Hi ${firstname},\n\nYour verification code is: ${verificationCode}\n\nIt will expire in 15 minutes. Please request a new code if it expires.\n\nThank you!`,
      };
      await mg.messages().send(emailData);

      res.status(201).json({ message: "Signup successful! Please verify your email.", redirect: "email-verify.html" });

  } catch (error) {
      console.error("Error during signup:", error);
      res.status(500).json({ message: "Error registering user", error });
  }
});


// 🔹 Verify Email Route
router.post("/verify-email", async (req, res) => {
  const { email, code } = req.body;

  try {
      // 🔹 Find user by email
      const user = await User.findOne({ where: { email } });

      if (!user) {
          return res.status(404).json({ message: "User not found." });
      }

      if (user.isVerified) {
          return res.status(400).json({ message: "User is already verified." });
      }

      if (user.verificationCode !== code) {
          return res.status(400).json({ message: "Invalid verification code!" });
      }

      if (user.verificationExpires && new Date(user.verificationExpires) < new Date()) {
          return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
      }

      // 🔹 Update user to mark as verified
      await user.update({
          isVerified: true,
          verificationCode: null,
          verificationExpires: null,
      });

      res.status(200).json({ message: "Email verified successfully!" });

  } catch (error) {
      console.error("Error verifying email:", error);
      res.status(500).json({ message: "Error verifying email.", error });
  }
});

// 🔹 Resend Verification Code Route
router.post("/resend-code", async (req, res) => {
  const { email } = req.body;

  try {
      // 🔹 Find user by email
      const user = await User.findOne({ where: { email } });

      if (!user) {
          return res.status(404).json({ message: "User not found." });
      }

      if (user.isVerified) {
          return res.status(400).json({ message: "User is already verified." });
      }

      // 🔹 Generate a new verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // 🔹 Update verification code & expiry
      await user.update({
          verificationCode: verificationCode,
          verificationExpires: new Date(Date.now() + 15 * 60 * 1000), // Expires in 15 mins
      });

      // 🔹 Send new code via email
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


// 🔹 Login Route
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
      // 🔹 Check if user exists
      const user = await User.findOne({ where: { username } });

      if (!user) {
          return res.status(400).json({ message: "Invalid username or password" });
      }

      // 🔹 Compare password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
          return res.status(400).json({ message: "Invalid username or password" });
      }

      // 🔹 Check if email is verified
      if (!user.isVerified) {
          return res.status(403).json({ message: "Email not verified", redirect: "email-verify.html", email: user.email });
      }

      // 🔹 Generate JWT
      const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "1h" });

      res.status(200).json({ message: "Login successful", token });
  } catch (error) {
      console.error("Error logging in:", error);
      res.status(500).json({ message: "Error logging in. Please try again.", error });
  }
});

// 🔹 Get User Info Route
router.get("/user-info", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
      return res.status(401).json({ message: "Token not provided or invalid" });
  }

  try {
      // 🔹 Decode token
      const decoded = jwt.verify(token, SECRET_KEY);
      
      // 🔹 Find user by primary key (PostgreSQL uses `id`)
      const user = await User.findByPk(decoded.id);

      if (!user) {
          return res.status(404).json({ message: "User not found" });
      }

      res.status(200).json({ userId: user.id, username: user.username, firstname: user.firstname });

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

  if (!email) {
      return res.status(400).json({ message: "Email is required." });
  }

  try {
      // 🔹 Find user by email
      const user = await User.findOne({ where: { email } });

      if (!user) {
          return res.status(404).json({ message: "No account found with this email." });
      }

      // 🔹 Prepare email data
      const emailData = {
          from: `${EMAILNAME} <noreply@${DOMAIN}>`,
          to: email,
          subject: `Your requested username for Roshan's AppHub Login`,
          text: `Hello ${user.firstname},\n\nYou made a request for your username. It is: ${user.username}\n\nIf you did not make this request, we suggest securing your account by changing your password or email address.\n\nThank you!`,
      };

      // 🔹 Send email with username
      await mg.messages().send(emailData);

      res.status(200).json({ message: `If there is an account associated with ${email}, the username has been sent to that address. Please check your email app.` });

  } catch (error) {
      console.error("Error during reset username:", error);
      res.status(500).json({ message: "An error occurred. Please try again later." });
  }
});


router.post("/reset-password-request", async (req, res) => {
  const { username, email } = req.body;

  if (!username || !email) {
      return res.status(400).json({ message: "Please enter both fields." });
  }

  try {
      // 🔹 Find user by username & email
      const user = await User.findOne({ where: { username, email } });

      if (!user) {
          return res.status(404).json({ message: "User not found with the provided information." });
      }

      // 🔹 Generate password reset token
      const token = jwt.sign({ id: user.id }, SECRET_KEY, { expiresIn: "15m" });

      const resetLink = `https://roshansubedi.me/my-apps/reset-password-confirm.html?token=${token}`;

      // 🔹 Send reset email
      const emailData = {
          from: `${EMAILNAME} <noreply@${DOMAIN}>`,
          to: user.email,
          subject: "Reset your Password",
          html: `
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
      // 🔹 Verify the token
      const decoded = jwt.verify(token, SECRET_KEY);
      const userId = decoded.id;

      // 🔹 Find user by primary key
      const user = await User.findByPk(userId);

      if (!user) {
          return res.status(404).json({ message: "Invalid token or user does not exist." });
      }

      // 🔹 Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 🔹 Update the user's password
      await user.update({ password: hashedPassword });

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
      // 🔹 Verify JWT token
      const decoded = jwt.verify(token, SECRET_KEY);
      
      // 🔹 Find user by primary key
      const user = await User.findByPk(decoded.id);

      if (!user) {
          return res.status(404).json({ message: "User not found." });
      }

      // 🔹 Compare current password
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
          return res.status(400).json({ message: "Current password is incorrect." });
      }

      // 🔹 Hash new password and update user
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await user.update({ password: hashedPassword });

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
      // 🔹 Verify JWT token
      const decoded = jwt.verify(token, SECRET_KEY);
      
      // 🔹 Find user by primary key
      const user = await User.findByPk(decoded.id);

      if (!user) {
          return res.status(404).json({ message: "User not found." });
      }

      // 🔹 Generate new verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

      // 🔹 Update user email & verification status
      await user.update({
          email: newEmail,
          isVerified: false,
          verificationExpires: new Date(Date.now() + 15 * 60 * 1000), // Expires in 15 mins
          verificationCode: verificationCode,
      });

      // 🔹 Send verification email
      const emailData = {
          from: `${EMAILNAME} <noreply@${DOMAIN}>`,
          to: newEmail,
          subject: "Verify your email | Roshan's AppHub",
          text: `Hi ${user.firstname},\n\nYour verification code is: ${verificationCode}\n\nIt will expire in 15 minutes. Please request a new code if it expires.\n\nThank you!`,
      };

      await mg.messages().send(emailData);

      res.status(200).json({ message: "Email updated successfully. Please verify your new email." });

  } catch (error) {
      console.error("Error updating email:", error);
      res.status(500).json({ message: "Error updating email." });
  }
});

  
router.delete("/delete-account", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  try {
      // 🔹 Verify JWT token
      const decoded = jwt.verify(token, SECRET_KEY);

      // 🔹 Find user by primary key
      const user = await User.findByPk(decoded.id);

      if (!user) {
          return res.status(404).json({ message: "User not found." });
      }

      // 🔹 Delete user from the database
      await User.destroy({ where: { id: decoded.id } });

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
      // 🔹 Verify JWT token
      const decoded = jwt.verify(token, SECRET_KEY);

      // 🔹 Find user by primary key
      const user = await User.findByPk(decoded.id);

      if (!user) {
          return res.status(404).json({ message: "User not found." });
      }

      // 🔹 Update user's profile
      await user.update({
          firstname: firstname,
          lastname: lastname,
      });

      res.status(200).json({ message: "Profile updated successfully." });

  } catch (error) {
      console.error("Error updating profile:", error);
      res.status(400).json({ message: "Invalid or expired token." });
  }
});

  

module.exports = router;
