const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const mailgun = require("mailgun-js");
const DOMAIN = "mg.roshansubedi.me";
const mg = mailgun({ apiKey: process.env.MAILGUN_API_KEY, domain:DOMAIN });

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

        await mg.messages().send({
          from: `noreply@${DOMAIN}`,
          to: email,
          subject: "Verify your email | Roshan's AppHub",
          text: `Hi ${firstname},\n\nYour verification code is: ${verificationCode}\n\nIt will expire in 15 minutes.\n\nThank you!`,
        })

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
            from: `noreply@${DOMAIN}`,
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
        res.status(500).json({ message: "Error logging in", error });
    }
});

router.get("/user-info", async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  
    try {
      const decoded = jwt.verify(token, SECRET_KEY); // Decode the token
      const user = await User.findById(decoded.id); // Fetch the user from the database
  
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
  
      res.status(200).json({ userId: user._id, username: user.username }); // Include username
    } catch (error) {
      res.status(401).json({ message: "Invalid token" });
    }
  });

module.exports = router;