const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isLogin, isLogout } = require('../middlewares/auth'); 

// Show Signup Page
router.get('/signup', isLogout, userController.getSignupPage);

// Handle Signup Submission
router.post('/signup', isLogout, userController.handleSignup);

// Show OTP Page (with safety check)
router.get('/verify-otp', isLogout, (req, res) => {
    // Security: Only allow access if a signup is actually in progress
    if (!req.session.otp || !req.session.tempUserData) {
        return res.redirect('/signup');
    }
    res.render('user/otp'); 
});

// Handle OTP Verification
router.post('/verify-otp', isLogout, userController.verifyOTP);

// Handle Resending OTP
router.post('/resend-otp', isLogout, userController.resendOTP);

// Show Login Page
router.get('/login', isLogout, userController.getLoginPage);

// Handle Login Submission
router.post('/login', isLogout, userController.handleLogin);

// Handle Logout
router.get('/logout', isLogin, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Session destroy error:", err);
            return res.redirect('/'); 
        }
        res.clearCookie('connect.sid'); 
        // Redirecting with a query param can help show a "Logged out" message if you want
        res.redirect('/login?message=Logged%20out%20successfully');
    });
});


// Home Page (Middleware handles the caching headers)
router.get('/', isLogin, (req, res) => {
    res.render('user/home', { user: req.session.user });
});

module.exports = router;