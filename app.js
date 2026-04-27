const express = require('express');
const connectDB = require('./config/db');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

connectDB();

app.listen(process.env.PORT, () => console.log(`Server is running on port ${process.env.PORT}`));