const userService = require('../services/userService');

// Function to show the signup page
const getSignupPage = (req, res) => {
    try {
        res.render('user/signup'); // We will create this EJS file next
    } catch (error) {
        res.status(500).send("Server Error");
    }
};

// Function to handle the form submission
const handleSignup = async (req, res) => {
    try {
        // We pass the whole body (username, email, phone, password) to the service
        const newUser = await userService.registerUser(req.body);
        
        // If successful, redirect to login (we will build login later)
        res.redirect('/login'); 
    } catch (error) {
        // If the service throws an error (like user already exists), show it on the page
        res.render('user/signup', { error: error.message });
    }
};

module.exports = {
    getSignupPage,
    handleSignup
};