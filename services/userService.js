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

// Adds a new address object to the user's addresses array
 
const addAddress = async (userId, addressData) => {
    return await User.findByIdAndUpdate(
        userId,
        { $push: { addresses: addressData } },
        { new: true }
    );
};

//  Removes an address from the array using its unique _id
 
const removeAddress = async (userId, addressId) => {
    return await User.findByIdAndUpdate(
        userId,
        { $pull: { addresses: { _id: addressId } } },
        { new: true }
    );
};

const setDefaultAddress = async (userId, addressId) => {
    try {
        //  Reset all addresses to isSelected: false
        await User.updateOne(
            { _id: userId },
            { $set: { "addresses.$[].isSelected": false } }
        );

        // Set the target address to isSelected: true
        const result = await User.updateOne(
            { _id: userId, "addresses._id": addressId },
            { $set: { "addresses.$.isSelected": true } }
        );

        return result.modifiedCount > 0;
    } catch (error) {
        throw new Error("Service Error: Unable to set default address");
    }
};

const updatePassword = async (email, password) => {
    try {
        //  Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        //  Update the user record
        const result = await User.updateOne(
            { email: email },
            { $set: { password: hashedPassword } }
        );
        
        return result;
    } catch (error) {
        console.error("Service Error updating password:", error);
        throw error;
    }
}


module.exports = {
    findUserByEmail,
    registerUser,
    getUserById,
    updateProfileImage,
    addAddress,    
    removeAddress,
    setDefaultAddress,
    updatePassword
};