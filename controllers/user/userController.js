const userService = require("../../services/userService");
const sendOTP = require("../../utils/sendEmail");
const bcrypt = require("bcrypt");
const User = require("../../models/userModel");

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
            if (req.session.tempUserData) {
                await userService.registerUser(req.session.tempUserData);
                req.session.otp = null;
                req.session.tempUserData = null;
                
                if (req.headers['content-type'] === 'application/json') {
                    return res.json({ success: true });
                }
                return res.redirect("/login");
            } 
            
            req.session.otp = null; 
            return res.json({ success: true });
            
        } else {
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
        const email = req.session.tempUserData ? req.session.tempUserData.email : 
                     (req.session.pendingEmailUpdate ? req.session.pendingEmailUpdate.newEmail : req.session.forgotPasswordEmail);
        
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

        // BLOCK CHECK (from admin side) 
        if (user.isBlocked) {
            return res.render("user/login", { 
                error: "Your account has been suspended. Please contact support." 
            });
        }
        

        if (user.googleId && !user.password) {
            return res.render("user/login", { 
                error: "This email is linked to Google Sign-In. Please use the 'Sign in with Google' button." 
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            req.session.user = {
                id: user._id,
                username: user.username,
                email: user.email,
                image: user.profileImage || null 
            };
            return res.redirect("/");
        } else {
            return res.render("user/login", { error: "Invalid credentials" });
        }
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).render("user/login", { error: "An internal server error occurred." });
    }
};

// Load Home Page
const loadHome = async (req, res) => {
    try {
        let user = req.session.user || null;

        // Security: verify session user is not blocked
        if (user) {
            const dbUser = await User.findById(user.id || user._id);
            if (!dbUser || dbUser.isBlocked) {
                req.session.destroy();
                return res.redirect("/login");
            }
        }

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

        // Security: Check if user exists and is not blocked
        if (!user || user.isBlocked) {
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

// Render the separate Edit Profile Page
const getEditProfile = async (req, res) => {
    try {
        if (!req.session.user) return res.redirect("/login");
        
        const userId = req.session.user.id || req.session.user._id;
        const user = await userService.getUserById(userId);
        
        res.render("user/edit-profile", { user });
    } catch (error) {
        console.error("Error rendering edit profile:", error);
        res.redirect("/profile");
    }
};

// Handle the Profile Update POST request
const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const { username, phone, email } = req.body;
        
        const user = await userService.getUserById(userId);

        if (user.googleId && email !== user.email) {
            return res.status(400).json({ 
                success: false, 
                message: "Email cannot be changed for Google accounts." 
            });
        }

        if (email !== user.email) {
            const emailTaken = await userService.isEmailTakenByAnother(email, userId);
            if (emailTaken) {
                return res.status(400).json({ success: false, message: "This email is already in use." });
            }

            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            
            req.session.pendingEmailUpdate = { userId, newEmail: email, username, phone };
            req.session.otp = otp;

            const emailSent = await sendOTP(email, otp);
            if (emailSent) {
                return res.json({ 
                    success: true, 
                    requiresOTP: true, 
                    message: "Verification code sent to your new email." 
                });
            } else {
                return res.status(500).json({ success: false, message: "Failed to send verification code." });
            }
        }

        const updatedUser = await userService.updateUserDetails(userId, { username, phone });

        if (updatedUser) {
            req.session.user.username = updatedUser.username;
            return res.json({ success: true, message: "Profile updated successfully!" });
        }
        
        res.status(400).json({ success: false, message: "Failed to update profile." });

    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// Finalize Email Change after OTP verification
const verifyEmailUpdateOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const pending = req.session.pendingEmailUpdate;

        if (!pending || otp !== req.session.otp) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
        }

        await userService.updateUserEmail(pending.userId, pending.newEmail);
        await userService.updateUserDetails(pending.userId, { 
            username: pending.username, 
            phone: pending.phone 
        });

        req.session.user.email = pending.newEmail;
        req.session.user.username = pending.username;

        delete req.session.otp;
        delete req.session.pendingEmailUpdate;

        res.json({ success: true, message: "Email and profile updated successfully!" });
    } catch (error) {
        console.error("Verify Email OTP Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// Update Profile Avatar
const updateAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image provided' });
        }
        const userId = req.session.user.id || req.session.user._id;
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

// Address Management functions
const loadAddressPage = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const user = await userService.getUserById(userId);
        res.render("user/address", { user, addresses: user.addresses || [] });
    } catch (error) {
        res.status(500).send("Error loading addresses");
    }
};

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const { fullname, addressType, address, city, pincode, phone } = req.body;
        await userService.addAddress(userId, { fullname, addressType, address, city, pincode, phone });
        res.redirect("/address");
    } catch (error) {
        res.status(500).send("Error adding address");
    }
};

const getEditAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user.id || req.session.user._id;
        const user = await User.findById(userId);
        const address = user.addresses.id(addressId); 
        res.render('user/editaddress', { user, address });
    } catch (error) {
        res.redirect('/address');
    }
};

const postEditAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user.id || req.session.user._id;
        const { fullname, phone, address, city, pincode, addressType } = req.body;
        
        await User.updateOne(
            { _id: userId, "addresses._id": addressId },
            { $set: { "addresses.$": { fullname, phone, address, city, pincode, addressType } } }
        );
        
        res.redirect('/address');
    } catch (error) {
        res.status(500).send("Update Failed");
    }
};

const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const addressId = req.params.id;
        await userService.removeAddress(userId, addressId);
        res.json({ success: true, message: "Address deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const handleSetDefaultAddress = async (req, res) => {
    try {
        const { addressId } = req.body;
        const userId = req.session.user.id || req.session.user._id;
        const success = await userService.setDefaultAddress(userId, addressId);
        res.json({ success });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

// Password Reset Flow
const handleForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await userService.findUserByEmail(email);
        if (!user) return res.render("user/forgotEmail", { error: "No account found." });

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        req.session.forgotPasswordEmail = email; 
        req.session.otp = otp;
        await sendOTP(email, otp);
        res.redirect("/forgot-password-otp");
    } catch (error) {
        res.status(500).render("user/forgotEmail", { error: "Internal Error" });
    }
};

const handleResetPassword = async (req, res) => {
    try {
        const email = req.session.forgotPasswordEmail;
        const { password } = req.body;
        if (!email) return res.json({ success: false, message: "Session expired." });
        const result = await userService.updatePassword(email, password);
        if (result.modifiedCount > 0) {
            delete req.session.forgotPasswordEmail;
            return res.json({ success: true });
        }
        res.json({ success: false });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

const changePassword = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const { currentPassword, newPassword } = req.body;

        const user = await userService.getUserById(userId);

        if (user.googleId && !user.password) {
            return res.status(400).json({ 
                success: false, 
                message: "Password management is handled by Google for this account." 
            });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: "Incorrect current password." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.updateOne({ _id: userId }, { $set: { password: hashedPassword } });

        res.json({ success: true, message: "Password updated successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

module.exports = {
    loadProfile,
    getEditProfile,
    updateProfile,
    verifyEmailUpdateOTP, 
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
    handleForgotPassword,
    changePassword
};