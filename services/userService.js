const User = require('../models/userModel');
const bcrypt = require('bcrypt');

//  Check if the email is already in the DB
const findUserByEmail = async (email) => {
    return await User.findOne({ email: email });
};

//  Hash password and save to MongoDB
const registerUser = async (userData) => {
    const { username, email, phone, password } = userData;
    
    // Hash the password for security
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
        username,
        email,
        phone,
        password: hashedPassword
    });

    return await newUser.save();
};

module.exports = {
    findUserByEmail,
    registerUser
};