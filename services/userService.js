const User = require('../models/userModel');
const bcrypt = require('bcrypt');

const registerUser = async (userData) => {
    try {
        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ email: userData.email }, { phone: userData.phone }] 
        });

        if (existingUser) {
            throw new Error('User with this email or phone already exists');
        }

        // Hash password (same logic as your previous project)
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        // Create new user with iZen fields
        const newUser = new User({
            username: userData.username,
            email: userData.email,
            phone: userData.phone,
            password: hashedPassword
        });

        return await newUser.save();
    } catch (error) {
        throw error;
    }
};

module.exports = {
    registerUser
};