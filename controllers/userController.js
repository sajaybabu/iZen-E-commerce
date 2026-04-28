const userService = require('../services/userService');
const sendOTP = require('../utils/sendEmail');
const bcrypt = require('bcrypt');

// 1. Show the Signup Page
const getSignupPage = (req, res) => {
    try {
        res.render('user/signup'); 
    } catch (error) {
        res.status(500).send("Server Error");
    }
};

// 2. Handle Signup Form Submission
const handleSignup = async (req, res) => {
    try {
        const { username, email, phone, password } = req.body;

        const userExists = await userService.findUserByEmail(email);
        if (userExists) {
            return res.render('user/signup', { error: "User already exists with this email" });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        req.session.tempUserData = { username, email, phone, password };
        req.session.otp = otp;

        const emailSent = await sendOTP(email, otp);

        if (emailSent) {
            console.log(`OTP for ${email}: ${otp}`); 
            res.redirect('/verify-otp'); 
        } else {
            res.render('user/signup', { error: "Failed to send OTP. Please try again." });
        }

    } catch (error) {
        console.error("Signup Error:", error);
        res.render('user/signup', { error: "An error occurred. Please try again." });
    }
};

// 3. Verify OTP and Register User
const verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionOtp = req.session.otp;

        if (otp === sessionOtp) {
            const userData = req.session.tempUserData;

            // Save user to Database
            await userService.registerUser(userData);

            // Clear temporary session data
            req.session.otp = null;
            req.session.tempUserData = null;

            // Redirect to login page after successful registration
            return res.redirect('/login');
        } else {
            // If OTP fails, render the OTP page again with an error
            return res.render('user/otp', { error: "Invalid OTP. Please try again." });
        }
    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

// 4. Show the Login Page
const getLoginPage = (req, res) => {
    res.render('user/login');
};

// 5. Handle Login Submission
const handleLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userService.findUserByEmail(email);

        if (!user) {
            // Render the login page again with an error message
            return res.render('user/login', { error: "Email not found in our database" });
        }

        // Compare typed password with hashed password in DB
        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            // Success: Create the official user session
            req.session.user = {
                id: user._id,
                username: user.username,
                email: user.email
            };
            
            return res.redirect('/'); 
        } else {
            // Wrong password: show error on login page
            return res.render('user/login', { error: "Invalid email or password" });
        }

    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).send("An error occurred during login");
    }
};

module.exports = {
    getSignupPage,
    handleSignup,
    verifyOTP,
    getLoginPage,
    handleLogin
};