const User = require('../models/adminModel'); // For Admin Auth & User management
const Category = require('../models/categoryModel');
const userSchema = require('../models/userModel'); // From your customerController
const bcrypt = require('bcrypt');


// --- USER/CUSTOMER LOGIC ---
const fetchUsers = async (skip, limit, isAdmin = false) => {
    const users = await userSchema.find({ isAdmin })
        .sort({ _id: -1 }) // Your preferred sorting
        .skip(skip)
        .limit(limit);
    const count = await userSchema.countDocuments({ isAdmin });
    return { users, count };
};

const findUserByEmail = async (email) => {
    return await User.findOne({ email });
};

const updateUserStatus = async (id, isBlocked) => {
    return await userSchema.findByIdAndUpdate(id, { $set: { isBlocked } }, { new: true });
};

// --- CATEGORY LOGIC ---
const fetchCategories = async (skip, limit, query = {}) => {
    const finalQuery = { ...query, isDeleted: { $ne: true } };

    const categories = await Category.find(finalQuery)
        .sort({ createdAt: -1 }) // Sort descending
        .skip(skip)
        .limit(limit);

    const count = await Category.countDocuments(finalQuery);
    return { categories, count };
};

const createCategory = async (catData) => {
    const existing = await Category.findOne({ name: { $regex: new RegExp(`^${catData.name}$`, 'i') } });
    if (existing) throw new Error("Category already exists");
    return await new Category(catData).save();
};



module.exports = {
    fetchUsers,
    findUserByEmail,
    updateUserStatus,
    fetchCategories,
    createCategory
};