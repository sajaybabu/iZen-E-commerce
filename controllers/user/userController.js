const User = require("../../models/userModel");
const userService = require("../../services/userService");
const sendOTP = require("../../utils/sendEmail");
const bcrypt = require("bcrypt");

// Show the Signup Page
const getSignupPage = (req, res) => {
    try {
        res.render("user/signup");
    } catch (error) {
        res.status(500).send("Server Error");
    }
};

// Handle Signup Form Submission
const handleSignup = async (req, res) => {
    try {
        const { username, email, phone, password } = req.body;
        const userExists = await userService.findUserByEmail(email);

        if (userExists) {
            return res.render("user/signup", {
                error: "User already exists with this email",
            });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        req.session.tempUserData = { username, email, phone, password };
        req.session.otp = otp;

        const emailSent = await sendOTP(email, otp);
        if (emailSent) {
            res.redirect("/verify-otp");
        } else {
            res.render("user/signup", {
                error: "Failed to send OTP. Please try again.",
            });
        }
    } catch (error) {
        res.render("user/signup", {
            error: "An error occurred. Please try again.",
        });
    }
};

// Verify OTP
const verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        if (otp === req.session.otp) {
            await userService.registerUser(req.session.tempUserData);
            req.session.otp = null;
            req.session.tempUserData = null;
            return res.redirect("/login");
        } else {
            return res.render("user/otp", {
                error: "Invalid OTP. Please try again.",
            });
        }
    } catch (error) {
        res.render("user/otp", { error: "Internal Server Error" });
    }
};

// Resend OTP 
const resendOTP = async (req, res) => {
    try {
        const { email } = req.session.tempUserData;
        const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
        req.session.otp = newOtp;

        const emailSent = await sendOTP(email, newOtp);
        if (emailSent) {
            return res.json({ success: true, message: "A new code has been sent!" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to send OTP" });
        }
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// Handle Login Submission
const handleLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userService.findUserByEmail(email);

        if (!user) {
            return res.render("user/login", { error: "Email not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            req.session.user = {
                id: user._id,
                username: user.username,
                email: user.email,
            };
            return res.redirect("/");
        } else {
            return res.render("user/login", { error: "Invalid credentials" });
        }
    } catch (error) {
        res.status(500).send("Login Error");
    }
};

// Load Home Page
const loadHome = async (req, res) => {
    try {
        const user = req.session.user || null;
        const newArrivals = [];
        const inOffer = [];
        const wishlist = null;

        res.render("user/home", {
            user,
            newArrivals,
            inOffer,
            wishlist,
        });
    } catch (err) {
        res.status(500).send("Internal Server Error");
    }
};

// Load Profile Page
const loadProfile = async (req, res) => {
    try {
        const userData = req.session.user;
        if (!userData) return res.redirect("/login");

        // Calling service layer instead of direct DB call
        const user = await userService.getUserById(userData.id);

        if (!user) {
            req.session.destroy();
            return res.redirect("/login");
        }

        res.render("user/profile", { user });
    } catch (error) {
        res.status(500).render("error", { message: "Could not load profile" });
    }
};

// Update Profile Avatar
const updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image provided' });
        }

        const userId = req.session.user.id || req.session.user._id;
        const imagePath = `/uploads/profile/${req.file.filename}`;

        // Using service layer
        await userService.updateProfileImage(userId, imagePath);

        res.json({ 
            success: true, 
            message: 'Profile picture updated!',
            imagePath: imagePath 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

module.exports = {
    loadProfile,
    getSignupPage,
    handleSignup,
    verifyOTP,
    resendOTP,
    getLoginPage: (req, res) => res.render("user/login"),
    handleLogin,
    loadHome,
    updateAvatar 
};
