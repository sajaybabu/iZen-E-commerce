const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Route for showing the page
router.get('/signup', userController.getSignupPage);

// Route for submitting the form
router.post('/signup', userController.handleSignup);

router.get('/verify-otp', (req, res) => {
    // If there's no OTP in session
    if (!req.session.otp) {
        return res.redirect('/signup');
    }
    res.render('user/otp'); 
});

// Route to handle the OTP submission from the frontend
router.post('/verify-otp', userController.verifyOTP);

module.exports = router;