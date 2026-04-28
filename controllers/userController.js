const userService = require('../services/userService');
const sendOTP = require('../utils/sendEmail'); // The tool we created earlier

// Function to show the signup page
const getSignupPage = (req, res) => {
    try {
        res.render('user/signup'); 
    } catch (error) {
        res.status(500).send("Server Error");
    }
};

// Function to handle the form submission 
const handleSignup = async (req, res) => {
    try {
        const { username, email, phone, password } = req.body;

        // 1. Check if user already exists 
        const userExists = await userService.findUserByEmail(email);
        if (userExists) {
            return res.render('user/signup', { error: "User already exists with this email" });
        }

        // 2. Generate a 4-digit OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // 3. Store Data in Session 
        req.session.tempUserData = { username, email, phone, password };
        req.session.otp = otp;

        // 4. Send the Email
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

const verifyOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionOtp = req.session.otp;

        // 1. Check if the OTP matches
        if (otp === sessionOtp) {
            // SUCCESS! Get the user data we were holding in the session
            const userData = req.session.tempUserData;

            // 2. Call your service to actually save the user to the Database
            const newUser = await userService.registerUser(userData);

            // 3. Clear the session 
            req.session.otp = null;
            req.session.tempUserData = null;

            // 4. Log the user in automatically
            req.session.user = newUser;

            return res.json({ success: true, message: "Registration successful!" });
        } else {
            // FAILURE: Wrong OTP
            return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
        }
    } catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ success: false, message: error.message || "Server Error" });
    }
};


module.exports = {
    getSignupPage,
    handleSignup,
    verifyOTP 
};