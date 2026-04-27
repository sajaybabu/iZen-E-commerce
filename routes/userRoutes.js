const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Route for showing the page
router.get('/signup', userController.getSignupPage);

// Route for submitting the form
router.post('/signup', userController.handleSignup);

module.exports = router;