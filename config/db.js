const mongoose = require('mongoose');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyUrl = process.env.QUOTAGUARDSTATIC_URL;
const agent = new HttpsProxyAgent(proxyUrl);

const connectDB = async () => {
    // try {
    //     await mongoose.connect(process.env.MONGO_URI, { httpAgent: agent });
    //     console.log('Connected to MongoDB Atlas');
    // } catch (error) {
    //     console.error('Error connecting to MongoDB:', error);
    //     process.exit(1);
    // }


    try {
        // Modify connection options for the agent
        const connectionOptions = {
            serverSelectionTimeoutMS: 5000,
            directConnection: true,
            driverInfo: {
                name: "mongodb",
                version: "4.1"
            },
            useNewUrlParser: true,
            useUnifiedTopology: true,
            httpAgent: agent, // Pass the agent
        };

        await mongoose.connect(process.env.MONGO_URI, connectionOptions);
        console.log('Connected to MongoDB Atlas');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1); // Exit process with failure
    }
};

module.exports = connectDB;

