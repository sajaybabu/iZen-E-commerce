const userSchema = require('../../models/userModel'); // Adjust path to your user model
const bcrypt = require('bcrypt');
const salt = 10;

// 1. List Users with Pagination and Sorting (Latest First)
const loadUserManagement = async (req, res) => {
    try {
        const userCount = await userSchema.countDocuments();
        const limit = 5;
        // Sorting by _id: -1 ensures the newest users appear at the top
        const users = await userSchema.find().sort({ _id: -1 }).limit(limit);

        const data = {
            users,
            nextPage: 1,
            prevPage: 0,
            prevDisable: "disabled",
            nextDisable: limit >= userCount ? "disabled" : null
        };

        res.render('admin/userManagement', data);
    } catch (err) {
        console.error("User management load error:", err);
        res.status(500).send("Internal Server Error");
    }
};

// 2. Block User
const blockUser = async (req, res) => {
    try {
        const { id } = req.body;
        await userSchema.findByIdAndUpdate(id, { $set: { isBlocked: true } });
        
        res.status(200).json({ message: "User has been blocked" });
    } catch (err) {
        res.status(500).json({ message: "Error blocking user" });
    }
};

// 3. Unblock User
const unBlockUser = async (req, res) => {
    try {
        const { id } = req.body;
        await userSchema.findByIdAndUpdate(id, { $set: { isBlocked: false } });
        res.status(200).json({ message: "User has been unblocked" });
    } catch (err) {
        res.status(500).json({ message: "Error unblocking user" });
    }
};

// 4. Pagination Logic
const pagination = async (req, res) => {
    try {
        const pageNo = Number(req.params.page) || 0;
        const limit = 5;
        const userCount = await userSchema.countDocuments();
        
        const users = await userSchema.find()
            .sort({ _id: -1 })
            .skip(limit * pageNo)
            .limit(limit);

        res.render('admin/userManagement', {
            users,
            nextPage: pageNo + 1,
            prevPage: pageNo - 1,
            prevDisable: pageNo === 0 ? "disabled" : null,
            nextDisable: (pageNo * limit + limit >= userCount) ? "disabled" : null
        });
    } catch (err) {
        res.status(500).send("Pagination error");
    }
};

// 5. Search User (Backend Logic)
const searchUser = async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.redirect('/admin/users');

        // Search for user by name (Case-insensitive)
        const users = await userSchema.find({
            username: { $regex: username, $options: 'i' }
        });

        res.render('admin/userManagement', {
            users,
            nextPage: null,
            prevPage: null,
            prevDisable: "disabled",
            nextDisable: "disabled"
        });
    } catch (err) {
        res.status(500).send("Search error");
    }
};

module.exports = {
    loadUserManagement,
    blockUser,
    unBlockUser,
    pagination,
    searchUser
};