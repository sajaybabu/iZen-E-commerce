const mongoose = require('mongoose');
const User = require('../../models/adminModel'); 
const bcrypt = require('bcrypt');

/**
 * @description Load the login page
 */
const loadLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            return res.redirect('/admin/dashboard');
        }
        res.render('admin/login', { message: null });
    } catch (err) {
        console.log("Failed to load the login page:", err);
        res.status(500).send("Internal Server Error");
    }
};

/**
 * @description Verify Admin Login 
 */
const loginVerify = async (req, res) => {
    try {
        const { email, password } = req.body;

    
        const admin = await User.findOne({ 
            email: { $regex: new RegExp("^" + email.trim() + "$", "i") } 
        });

        // Check if user exists AND if they are actually an admin
        if (!admin || (admin.isAdmin !== true && admin.isAdmin !== 'true')) {
            return res.status(404).json({ message: "Admin email not found or access denied" });
        }

        // 2. Compare the hashed password
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid password" });
        }
        
        // Replace the check in your adminController.js with this:
if (!admin) {
    console.log("FAIL REASON: Email not found in DB");
    return res.status(404).json({ message: "Admin email not found" });
}


if (admin.isAdmin !== true) {
    console.log("FAIL REASON: User found but isAdmin is not true");
    return res.status(403).json({ message: "Access denied: Not an admin" });
}
        // 3. Set session
        req.session.admin = admin._id;

        // 4. Send success response
        res.status(200).json({ url: '/admin/dashboard' });

    } catch (err) {
        console.error("Login verification failed:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

const loadDashboard = async (req, res) => {
    try {
        if (req.session.admin) {
            res.render('admin/dashboard'); 
        } else {
            res.redirect('/admin/login');
        }
    } catch (err) {
        console.log("Failed to load admin dashboard:", err);
        res.status(500).send("Internal Server Error");
    }
};

const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("Logout error:", err);
                return res.redirect('/admin/dashboard');
            }
            res.clearCookie('connect.sid'); 
            res.redirect('/admin/login');
        });
    } catch (err) {
        console.log("Logout failed:", err);
        res.status(500).send("Internal Server Error");
    }
};

module.exports = {
    loadLogin,
    loginVerify,
    loadDashboard,
    logout
};