const User = require('../../models/userModel');
const bcrypt = require('bcrypt');
const walletService = require('./walletService');

// Helper to generate a unique random referral code (e.g., IZ8A3K9)
const generateReferralCode = () => {
    return 'IZ' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Finds a user by their email address
const findUserByEmail = async (email) => {
    return await User.findOne({ email: email });
};

// Check if an email is already taken by a DIFFERENT user
const isEmailTakenByAnother = async (email, currentUserId) => {
    const user = await User.findOne({
        email: email,
        _id: { $ne: currentUserId }
    });
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

// Hashes password and creates a new user in the database with referral processing
const registerUser = async (userData) => {
    const { username, email, phone, password, referralCode } = userData;

    // Check if referral code is valid
    let referrer = null;
    if (referralCode) {
        referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() });
        if (!referrer) {
            throw new Error('Invalid referral code provided.');
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique referral code for the new user
    let newReferralCode = generateReferralCode();
    while (await User.findOne({ referralCode: newReferralCode })) {
        newReferralCode = generateReferralCode();
    }

    const newUser = new User({
        username,
        email,
        phone,
        password: hashedPassword,
        referralCode: newReferralCode,
        referredBy: referrer ? referrer._id : null
    });

    const savedUser = await newUser.save();

    // Process referral rewards if a valid referrer was provided ($20 credit each)
    if (referrer) {
        const REFERRAL_REWARD = 20;

        // Credit Referrer
        await walletService.creditWallet({
            userId: referrer._id,
            amount: REFERRAL_REWARD,
            purpose: 'referral_bonus',
            description: `Referral bonus credited for inviting ${savedUser.username}.`
        });

        // Credit New User (Sign-up Bonus)
        await walletService.creditWallet({
            userId: savedUser._id,
            amount: REFERRAL_REWARD,
            purpose: 'signup_referral_bonus',
            description: `Welcome bonus credited using referral code ${referralCode.toUpperCase()}.`
        });
    }

    return savedUser;
};

// Fetches a single user by their ID
const getUserById = async (userId) => {
    return await User.findById(userId);
};

// Updates the user's details
const updateUserDetails = async (userId, updateData) => {
    return await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        {
            returnDocument: 'after',
            runValidators: true
        }
    );
};

// Updates profile image
const updateProfileImage = async (userId, imagePath) => {
    return await User.findByIdAndUpdate(
        userId,
        { profileImage: imagePath },
        { returnDocument: 'after' }
    );
};

// Add address
const addAddress = async (userId, addressData) => {
    return await User.findByIdAndUpdate(
        userId,
        {
            $push: {
                addresses: addressData
            }
        },
        { returnDocument: 'after' }
    );
};

// Remove address
const removeAddress = async (userId, addressId) => {
    return await User.findByIdAndUpdate(
        userId,
        {
            $pull: {
                addresses: { _id: addressId }
            }
        },
        { returnDocument: 'after' }
    );
};

// Set default address
const setDefaultAddress = async (userId, addressId) => {
    await User.updateOne(
        { _id: userId },
        {
            $set: {
                "addresses.$[].isSelected": false
            }
        }
    );

    const result = await User.updateOne(
        {
            _id: userId,
            "addresses._id": addressId
        },
        {
            $set: {
                "addresses.$.isSelected": true
            }
        }
    );

    return result.modifiedCount > 0;
};

// Update password by email
const updatePassword = async (email, password) => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(
        password,
        salt
    );

    return await User.updateOne(
        { email: email },
        {
            $set: {
                password: hashedPassword
            }
        }
    );
};

// Change password by userId
const changeUserPassword = async (
    userId,
    hashedPassword
) => {
    return await User.updateOne(
        { _id: userId },
        {
            $set: {
                password: hashedPassword
            }
        }
    );
};

// Update address
const updateAddress = async (
    userId,
    addressId,
    addressData
) => {
    return await User.updateOne(
        {
            _id: userId,
            "addresses._id": addressId
        },
        {
            $set: {
                "addresses.$": addressData
            }
        }
    );
};

// Remove profile image
const removeProfileImage = async (userId) => {
    return await User.updateOne(
        { _id: userId },
        {
            $set: {
                profileImage: null
            }
        }
    );
};

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
    updatePassword,
    changeUserPassword,
    updateAddress,
    removeProfileImage
};