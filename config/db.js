const mongoose = require('mongoose');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyUrl = process.env.QUOTAGUARDSTATIC_URL;
const agent = new HttpsProxyAgent(proxyUrl);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB Atlas');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }

};

module.exports = connectDB;