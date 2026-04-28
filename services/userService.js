const User = require('../models/userModel');
const bcrypt = require('bcrypt');

// check if the email is already in the DB
const findUserByEmail = async (email) => {
    return await User.findOne({ email });
};

//  registration logic 
const registerUser = async (userData) => {
    const { username, email, phone, password } = userData;
    
    // Hash the password
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