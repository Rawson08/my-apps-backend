require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require("jsonwebtoken");

const corsOptions = {
    origin: ['https://roshansubedi.me', 'http://127.0.0.1:5500/'], // Frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'], // Customize headers if needed
    credentials: true, // Allow cookies if required
};


const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/auth', authRoutes);

app.use((req, res, next) => {
    res.status(404).json({ message: "Route not found in serverJS" });
});

// Start server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
