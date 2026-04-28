const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isLogin, isLogout } = require('../middlewares/auth'); 

// Route for showing the signup page
router.get('/signup', isLogout, userController.getSignupPage);

// Route for submitting the signup form
router.post('/signup', userController.handleSignup);

// Route to show the OTP page
router.get('/verify-otp', isLogout, (req, res) => {
    // Security: If there's no OTP in session, don't let them stay here
    if (!req.session.otp) {
        return res.redirect('/signup');
    }
    res.render('user/otp'); 
});

// Route to handle the OTP submission from the frontend
router.post('/verify-otp', userController.verifyOTP);


// Route to show the Login Page
router.get('/login', isLogout, userController.getLoginPage);

// Route to handle the Login form submission
router.post('/login', userController.handleLogin);

// Route to handle Logout
router.get('/logout', isLogin, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log("Session destroy error", err);
        }
        res.redirect('/login');
    });
});


// The Home Page (Only for logged-in users)
router.get('/', isLogin, (req, res) => {
    res.render('user/home', { user: req.session.user });
});

module.exports = router;