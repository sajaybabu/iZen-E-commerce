const User = require('../../models/userModel');
const bcrypt = require('bcrypt');
const walletService = require('./walletService');

const generateReferralCode = () => {
    return 'IZ' + Math.random().toString(36).substring(2, 8).toUpperCase();
};

const findUserByEmail = async (email) => {
    return await User.findOne({ email: email });
};

const isEmailTakenByAnother = async (email, currentUserId) => {
    const user = await User.findOne({
        email: email,
        _id: { $ne: currentUserId }
    });
    return !!user;
};

const updateUserEmail = async (userId, newEmail) => {
    return await User.findByIdAndUpdate(
        userId,
        { $set: { email: newEmail } },
        { returnDocument: 'after' }
    );
};

const registerUser = async (userData) => {
    const { username, email, phone, password, confirmPassword, referralCode } = userData;

    if (confirmPassword && password !== confirmPassword) {
        throw new Error('Passwords do not match.');
    }

    let referrer = null;
    if (referralCode) {
        referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() });
        if (!referrer) {
            throw new Error('Invalid referral code provided.');
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

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

    if (referrer) {
        const REFERRAL_REWARD = 20;

        await walletService.creditWallet({
            userId: referrer._id,
            amount: REFERRAL_REWARD,
            purpose: 'referral_bonus',
            description: `Referral bonus credited for inviting ${savedUser.username}.`
        });

        await walletService.creditWallet({
            userId: savedUser._id,
            amount: REFERRAL_REWARD,
            purpose: 'signup_referral_bonus',
            description: `Welcome bonus credited using referral code ${referralCode.toUpperCase()}.`
        });
    }

    return savedUser;
};

const getUserById = async (userId) => {
    return await User.findById(userId);
};

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

const updateProfileImage = async (userId, imagePath) => {
    return await User.findByIdAndUpdate(
        userId,
        { profileImage: imagePath },
        { returnDocument: 'after' }
    );
};

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