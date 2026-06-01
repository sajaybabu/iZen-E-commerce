const User = require('../../models/adminModel');
const bcrypt = require('bcrypt');

const getUsers = async (page) => {

    const limit = 8;
    const skip = (page - 1) * limit;

    const users = await User.find({
        isAdmin: false
    })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const count = await User.countDocuments({
        isAdmin: false
    });

    const totalPages = Math.ceil(count / limit);

    return {
        users,
        limit,
        totalPages
    };
};

const searchUsers = async (searchName) => {

    return await User.find({
        isAdmin: false,
        $or: [
            {
                username: {
                    $regex: searchName,
                    $options: 'i'
                }
            },
            {
                email: {
                    $regex: searchName,
                    $options: 'i'
                }
            }
        ]
    }).sort({ createdAt: -1 });
};

const createUser = async (
    username,
    email,
    password,
    phone
) => {

    const existingUser =
        await User.findOne({ email });

    if (existingUser) {
        throw new Error("User already exists");
    }

    const hashedPassword =
        await bcrypt.hash(password, 10);

    const newUser = new User({
        username,
        email,
        password: hashedPassword,
        phone: phone || "",
        isAdmin: false,
        isBlocked: false
    });

    return await newUser.save();
};

const blockUser = async (id) => {

    return await User.findByIdAndUpdate(
        id,
        {
            $set: {
                isBlocked: true
            }
        }
    );
};

const unBlockUser = async (id) => {

    return await User.findByIdAndUpdate(
        id,
        {
            $set: {
                isBlocked: false
            }
        }
    );
};

module.exports = {
    getUsers,
    searchUsers,
    createUser,
    blockUser,
    unBlockUser
};