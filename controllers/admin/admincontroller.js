const User = require('../../models/adminModel');
const bcrypt = require('bcrypt');


// AUTH FUNCTIONS 


const loadLogin = async (req, res) => {
    try {
        res.render('admin/login'); 
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
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
        req.session.destroy((err) => {
            if (err) console.log("Session destroy error:", err);
            res.clearCookie('connect.sid'); 
            res.redirect('/admin/login');
        });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/login');
    }
};


// USER MANAGEMENT 


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
        // Render the page with no message initially
        res.render('admin/addUser', { message: null }); 
    } catch (error) {
        res.redirect('/admin/userManagement');
    }
};

const addUser = async (req, res) => {
    try {
        const { username, email, password, phone } = req.body;
        
        //  Check if user already exists
        const existingUser = await User.findOne({ email: email });
        
        if (existingUser) {
            //  we render the EJS with a message variable
            return res.render('admin/addUser', { message: "User already exists with this email" });
        }

        // 2. Hash Password and Save
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
        
        // Success: Redirect back to the list
        res.redirect('/admin/userManagement');

    } catch (error) {
        console.error("Add User Error:", error);
        // Render with a general error message if something fails in the DB
        res.render('admin/addUser', { message: "Failed to add user. Please try again." });
    }
};

const searchUser = async (req, res) => {
    try {
        const { username } = req.body;

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
        const updated = await User.findByIdAndUpdate(
            id, 
            { $set: { isBlocked: true } }, 
            { new: true } 
        );

        if (updated) {
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
            { new: true }
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