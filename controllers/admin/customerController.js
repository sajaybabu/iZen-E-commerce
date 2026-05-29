const User = require('../../models/adminModel'); // Your working model
const bcrypt = require('bcrypt');

const loadUsers = async (req, res) => {
 try {
 const page = parseInt(req.query.page) || 1;
 const limit = 8;
 const skip = (page - 1) * limit;

 const userData = await User.find({ isAdmin: false })
.sort({ createdAt: -1 })
 .skip(skip)
 .limit(limit);

 const count = await User.countDocuments({ isAdmin: false });
 const totalPages = Math.ceil(count / limit);

res.render('admin/userManagement', {
 users: userData,
 currentPage: page,
 limit: limit,
 nextPage: page + 1,
 prevPage: page - 1,
 prevDisable: page <= 1 ? "disabled" : "",
 nextDisable: page >= totalPages ? "disabled" : "",
 search: ""
 });
 } catch (err) {
 console.error("Load Users Error:", err);
 res.status(500).send("Error loading users");
 }
}

const searchUser = async (req, res) => {
    try {
        let { username } = req.body;

        const searchName = username ? username.trim() : "";

        const userData = await User.find({
            isAdmin: false,
            $or: [
                { username: { $regex: searchName, $options: 'i' } },
                { email: { $regex: searchName, $options: 'i' } }
            ]
        }).sort({ createdAt: -1 });

        res.render('admin/userManagement', {
            users: userData,
            currentPage: 1,
            limit: 8,
            nextPage: 1,
            prevPage: 1,
            prevDisable: "disabled",
            nextDisable: "disabled",
            search: searchName 
        });
    } catch (err) {
        console.error("Search Error:", err);
        res.status(500).send("Search failed");
    }
};

const addUserPage = async (req, res) => {
    res.render('admin/addUser', { message: null }); 
};

const addUser = async (req, res) => {
    try {
        const { username, email, password, phone } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.render('admin/addUser', { message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username, email, password: hashedPassword, phone: phone || "",
            isAdmin: false, isBlocked: false 
        });
        await newUser.save();
        res.redirect('/admin/userManagement');
    } catch (error) {
        res.render('admin/addUser', { message: "Failed to add user." });
    }
};

const blockUser = async (req, res) => {
    try {
        const { id } = req.body;
        await User.findByIdAndUpdate(id, { $set: { isBlocked: true } });
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

const unBlockUser = async (req, res) => {
    try {
        const { id } = req.body;
        await User.findByIdAndUpdate(id, { $set: { isBlocked: false } });
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

module.exports = {
    loadUsers,
    searchUser,
    addUserPage,
    addUser,
    blockUser,
    unBlockUser
};