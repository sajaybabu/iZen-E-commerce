const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB Connected for iZen...");
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
};

module.exports = connectDB; 