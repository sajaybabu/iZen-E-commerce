const User = require('../../models/adminModel');
const bcrypt = require('bcrypt');

//  AUTH FUNCTIONS 

const loadLogin = async (req, res) => {
    try {
        res.render('admin/login'); 
    } catch (error) {
        console.log(error);
    }
};

const loginVerify = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });
        if (admin && await bcrypt.compare(password, admin.password)) {
            req.session.admin = admin._id;
            res.redirect('/admin/dashboard');
        } else {
            res.render('admin/login', { message: "Invalid Credentials" });
        }
    } catch (error) {
        console.log(error);
    }
};

const loadDashboard = async (req, res) => {
    try {
        res.render('admin/dashboard');
    } catch (error) {
        console.log(error);
    }
};

const logout = async (req, res) => {
    try {
        req.session.destroy();
        res.redirect('/admin/login');
    } catch (error) {
        console.log(error);
    }
};

//  USER MANAGEMENT FUNCTIONS 

const loadUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const userData = await User.find({ isAdmin: false })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const count = await User.countDocuments({ isAdmin: false });

        res.render('admin/userManagement', {
            users: userData,
            nextPage: page + 1,
            prevPage: page - 1,
            prevDisable: page <= 1 ? "disabled" : "",
            nextDisable: page >= Math.ceil(count / limit) ? "disabled" : "",
            search: ""
        });
    } catch (err) {
        res.status(500).send("Error loading users");
    }
};

const searchUser = async (req, res) => {
    try {
        const { username } = req.body;
        const userData = await User.find({
            isAdmin: false,
            username: { $regex: '.*' + username + '.*', $options: 'i' }
        }).sort({ createdAt: -1 });

        res.render('admin/userManagement', {
            users: userData,
            nextPage: 1,
            prevPage: 1,
            prevDisable: "disabled",
            nextDisable: "disabled",
            search: username
        });
    } catch (err) {
        res.status(500).send("Search failed");
    }
};

const blockUser = async (req, res) => {
    try {
        const { id } = req.body;
        await User.findByIdAndUpdate(id, { isListed: false });
        res.status(200).json({ message: "Blocked" });
    } catch (err) {
        res.status(500).json({ message: "Error" });
    }
};

const unBlockUser = async (req, res) => {
    try {
        const { id } = req.body;
        await User.findByIdAndUpdate(id, { isListed: true });
        res.status(200).json({ message: "Unblocked" });
    } catch (err) {
        res.status(500).json({ message: "Error" });
    }
};


module.exports = {
    loadLogin,
    loginVerify,
    loadDashboard,
    logout,
    loadUsers,
    searchUser,
    blockUser,
    unBlockUser
};