const User = require('../models/userModel');
const bcrypt = require('bcrypt');


 // Finds a user by their email address

const findUserByEmail = async (email) => {
    return await User.findOne({ email: email });
};

// Hashes password and creates a new user in the database
 
const registerUser = async (userData) => {
    const { username, email, phone, password } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = new User({
        username,
        email,
        phone,
        password: hashedPassword
    });

    return await newUser.save();
};

// Fetches a single user by their ID
 
const getUserById = async (userId) => {
    return await User.findById(userId);
};

 // Updates the user's profile image path
 
const updateProfileImage = async (userId, imagePath) => {
    return await User.findByIdAndUpdate(
        userId, 
        { profileImage: imagePath }, 
        { new: true }
    );
};

module.exports = {
    findUserByEmail,
    registerUser,
    getUserById,
    updateProfileImage
};