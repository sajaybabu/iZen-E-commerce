const User = require('../models/userModel');
const bcrypt = require('bcrypt');

// Finds a user by their email address
const findUserByEmail = async (email) => {
    return await User.findOne({ email: email });
};

// Check if an email is already taken by a DIFFERENT user
const isEmailTakenByAnother = async (email, currentUserId) => {
    const user = await User.findOne({ email: email, _id: { $ne: currentUserId } });
    return !!user; 
};

// Specialized function to update only the email after OTP verification
const updateUserEmail = async (userId, newEmail) => {
    return await User.findByIdAndUpdate(
        userId,
        { $set: { email: newEmail } },
        { returnDocument: 'after' }
    );
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

// Updates the user's details (Used for Name and Phone)
const updateUserDetails = async (userId, updateData) => {
    try {
        return await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { returnDocument: 'after', runValidators: true }
        );
    } catch (error) {
        throw new Error("Service Error: Unable to update user");
    }
};

// Updates the user's profile image path
const updateProfileImage = async (userId, imagePath) => {
    return await User.findByIdAndUpdate(
        userId, 
        { profileImage: imagePath }, 
        { returnDocument: 'after' }
    );
};

// Adds a new address object to the user's addresses array
const addAddress = async (userId, addressData) => {
    return await User.findByIdAndUpdate(
        userId,
        { $push: { addresses: addressData } },
        { returnDocument: 'after' }
    );
};

// Removes an address from the array using its unique _id
const removeAddress = async (userId, addressId) => {
    return await User.findByIdAndUpdate(
        userId,
        { $pull: { addresses: { _id: addressId } } },
        { returnDocument: 'after' }
    );
};

const setDefaultAddress = async (userId, addressId) => {
    try {
        await User.updateOne(
            { _id: userId },
            { $set: { "addresses.$[].isSelected": false } }
        );

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
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

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
    isEmailTakenByAnother, 
    updateUserEmail,       
    registerUser,
    getUserById,
    updateUserDetails,
    updateProfileImage,
    addAddress,    
    removeAddress,
    setDefaultAddress,
    updatePassword
};