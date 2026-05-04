const User = require('../../models/adminModel');
const bcrypt = require('bcrypt');

// AUTH FUNCTIONS 
const loadLogin = async (req, res) => {
    try {
        res.render('admin/login'); 
    } catch (error) {
        console.error(error);
    }
};

const loginVerify = async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await User.findOne({ email, isAdmin: true });

        if (admin && await bcrypt.compare(password, admin.password)) {
            req.session.admin = admin._id;
            return res.json({ success: true, redirectUrl: '/admin/userManagement' });
        } else {
            return res.status(401).json({ success: false, message: "Invalid Email or Password" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const logout = async (req, res) => {
    try {
        req.session.destroy();
        res.redirect('/admin/login');
    } catch (error) {
        console.error(error);
    }
};

//  USER MANAGEMENT 
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

        res.render('admin/userManagement', {
            users: userData,
            currentPage: page,
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

const addUserPage = async (req, res) => {
    try {
        res.render('admin/addUser'); 
    } catch (error) {
        res.redirect('/admin/userManagement');
    }
};

const addUser = async (req, res) => {
    try {
        const { username, email, password, phone } = req.body;
        const existingUser = await User.findOne({ email: email });
        
        if (existingUser) {
            return res.status(400).send("User already exists");
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            phone: phone || "",
            isAdmin: false,
            isBlocked: false 
        });

        await newUser.save();
        res.redirect('/admin/userManagement');
    } catch (error) {
        console.error(error);
        res.status(500).send("Failed to add user");
    }
};

const searchUser = async (req, res) => {
    try {
        const { username } = req.body;

        //$or allows us to check multiple fields at once
        const userData = await User.find({
            isAdmin: false,
            $or: [
                { username: { $regex: username, $options: 'i' } },
                { email: { $regex: username, $options: 'i' } }
            ]
        }).sort({ createdAt: -1 });

        res.render('admin/userManagement', {
            users: userData,
            currentPage: 1,
            nextPage: 1,
            prevPage: 1,
            prevDisable: "disabled",
            nextDisable: "disabled",
            search: username 
        });
    } catch (err) {
        console.error("Search Error:", err);
        res.status(500).send("Search failed");
    }
};

const blockUser = async (req, res) => {
    try {
        const { id } = req.body;
        console.log("Blocking user with ID:", id);
        
        // Use returnDocument: 'after' to see the changes in the 'updated' variable
        const updated = await User.findByIdAndUpdate(
            id, 
            { $set: { isBlocked: true } }, 
            { returnDocument: 'after' } 
        );

        if (updated) {
            console.log("User status in DB now:", updated.isBlocked); 
            res.status(200).json({ success: true, message: "User Blocked" });
        } else {
            res.status(404).json({ success: false, message: "User not found" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
};

const unBlockUser = async (req, res) => {
    try {
        const { id } = req.body;
        const updated = await User.findByIdAndUpdate(
            id, 
            { $set: { isBlocked: false } }, 
            { returnDocument: 'after' }
        );

        if (updated) {
            res.status(200).json({ success: true, message: "User Unblocked" });
        } else {
            res.status(404).json({ success: false, message: "User not found" });
        }
    } catch (err) {
        res.status(500).json({ success: false });
    }
};

// PLACEHOLDERS FOR DASHBOARD 
const loadDashboard = async (req, res) => {
    res.render('admin/dashboard'); 
};

const getFilterData = async (req, res) => {
    res.json({ success: true });
};

module.exports = {
    loadLogin,
    loginVerify,
    logout,
    loadUsers,
    addUserPage,
    addUser,
    searchUser,
    blockUser,
    unBlockUser,
    loadDashboard,
    getFilterData
};