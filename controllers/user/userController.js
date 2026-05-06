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
            // If it's a Signup flow (has tempUserData)
            if (req.session.tempUserData) {
                await userService.registerUser(req.session.tempUserData);
                req.session.otp = null;
                req.session.tempUserData = null;
                
                // If the request is AJAX (from forgotPassOtp.ejs), return JSON
                if (req.headers['content-type'] === 'application/json') {
                    return res.json({ success: true });
                }
                return res.redirect("/login");
            } 
            
            // If it's a Forgot Password flow
            req.session.otp = null; 
            return res.json({ success: true });
            
        } else {
            // If it's AJAX, return JSON error
            if (req.headers['content-type'] === 'application/json') {
                return res.json({ success: false, message: "Incorrect code." });
            }
            return res.render("user/otp", {
                error: "Invalid OTP. Please try again.",
            });
        }
    } catch (error) {
        console.error("Verify OTP Error:", error);
        if (req.headers['content-type'] === 'application/json') {
            return res.status(500).json({ success: false, message: "Internal Server Error" });
        }
        res.render("user/otp", { error: "Internal Server Error" });
    }
};

// Resend OTP 
const resendOTP = async (req, res) => {
    try {
        // Try to find email in signup session OR forgot password session
        const email = req.session.tempUserData ? req.session.tempUserData.email : req.session.forgotPasswordEmail;
        
        if (!email) {
            return res.status(400).json({ success: false, message: "Session expired. Please try again." });
        }

        const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
        req.session.otp = newOtp;

        const emailSent = await sendOTP(email, newOtp);
        if (emailSent) {
            return res.json({ success: true, message: "A new code has been sent!" });
        } else {
            return res.status(500).json({ success: false, message: "Failed to send OTP" });
        }
    } catch (error) {
        console.error("Resend OTP Error:", error);
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
                image: user.image || null 
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

        const user = await userService.getUserById(userData.id || userData._id);

        if (!user) {
            req.session.destroy();
            return res.redirect("/login");
        }

        if (!user.addresses) {
            user.addresses = [];
        }

        res.render("user/profile", { user });
    } catch (error) {
        console.error("Profile Load Error:", error);
        res.status(500).render("user/profile", { 
            user: null, 
            message: "Could not load fresh profile data" 
        });
    }
};

// Update Profile Avatar
const updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image provided' });
        }
        const userId = req.session.user.id;
        const imagePath = `uploads/profile/${req.file.filename}`;

        await userService.updateProfileImage(userId, imagePath);
        req.session.user.image = imagePath;

        res.json({ 
            success: true, 
            message: 'Profile picture updated!',
            path: imagePath 
        });
    } catch (error) {
        console.error("Avatar Upload Error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

// Load Address Page
const loadAddressPage = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await userService.getUserById(userId);
        
        res.render("user/address", { 
            user, 
            addresses: user.addresses || [] 
        });
    } catch (error) {
        console.error("Load Address Error:", error);
        res.status(500).send("Error loading addresses");
    }
};

// Add New Address
const addAddress = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { fullname, addressType, address, city, pincode, phone } = req.body;
        const newAddress = { fullname, addressType, address, city, pincode, phone };

        await userService.addAddress(userId, newAddress);
        res.redirect("/address");
    } catch (error) {
        console.error("Add Address Error:", error);
        res.status(500).send("Error adding address");
    }
};

const getEditAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const user = await User.findById(req.session.user);
        const address = user.addresses.id(addressId); 
        res.render('user/editaddress', { user, address });
    } catch (error) {
        res.redirect('/address');
    }
};

const postEditAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const { fullname, phone, address, city, pincode, addressType } = req.body;
        
        await User.updateOne(
            { _id: req.session.user, "addresses._id": addressId },
            { $set: { "addresses.$": { fullname, phone, address, city, pincode, addressType } } }
        );
        res.redirect('/address');
    } catch (error) {
        res.status(500).send("Update Failed");
    }
};

// Delete Address
const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const addressId = req.params.id;

        await userService.removeAddress(userId, addressId);
        res.json({ success: true, message: "Address deleted successfully" });
    } catch (error) {
        console.error("Delete Address Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


const handleSetDefaultAddress = async (req, res) => {
    try {
        const { addressId } = req.body;
        const userId = req.session.user.id || req.session.user._id;

        const success = await userService.setDefaultAddress(userId, addressId);

        if (success) {
            return res.json({ success: true });
        } else {
            return res.status(404).json({ success: false, message: "Address not found" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

const handleResetPassword = async (req, res) => {
    try {
        // Use the email saved during the OTP step
        const email = req.session.forgotPasswordEmail;
        const { password } = req.body;

        if (!email) {
            return res.json({ success: false, message: "Session expired. Please start over." });
        }

        // The service now handles the hashing
        const result = await userService.updatePassword(email, password);

        if (result.modifiedCount > 0) {
            // Success! Clear the forgot password session data
            delete req.session.forgotPasswordEmail;
            delete req.session.otp;
            
            return res.json({ success: true, message: "Password updated successfully!" });
        } else {
            return res.json({ success: false, message: "No changes made. Try a different password." });
        }
    } catch (error) {
        console.error("Reset Password Controller Error:", error);
        res.status(500).json({ success: false });
    }
};

// Handle initial email submission
const handleForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await userService.findUserByEmail(email);

        if (!user) {
            // use your filename forgotEmail.ejs
            return res.render("user/forgotEmail", { 
                error: "No account found with that email address." 
            });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        req.session.forgotPasswordEmail = email; // Save for resendOTP and handleResetPassword
        req.session.otp = otp;

        const emailSent = await sendOTP(email, otp);
        if (emailSent) {
            res.redirect("/forgot-password-otp");
        } else {
            res.render("user/forgotEmail", { 
                error: "Failed to send verification code. Try again." 
            });
        }
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).render("user/forgotEmail", { error: "An internal error occurred." });
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
    updateAvatar,
    loadAddressPage,
    addAddress,
    deleteAddress,
    getEditAddress,
    postEditAddress,
    handleSetDefaultAddress,
    handleResetPassword,
    handleForgotPassword
};