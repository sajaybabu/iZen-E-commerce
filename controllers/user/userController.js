const userService = require("../../services/userService");
const sendOTP = require("../../utils/sendEmail");
const bcrypt = require("bcrypt");
const User = require("../../models/userModel");

// --- PAGE RENDERS ---

const getSignupPage = (req, res) => {
    try {
        res.render("user/signup");
    } catch (error) {
        console.error("Signup Page Load Error:", error);
        res.status(500).send("Server Error");
    }
};

const getLoginPage = (req, res) => res.render("user/login");

const getForgotEmailPage = (req, res) => res.render("user/forgotEmail");

const getForgotOtpPage = (req, res) => res.render("user/forgotPassOtp");

const getResetPasswordPage = (req, res) => res.render("user/changePassword");

const getSignupOtpPage = (req, res) => {
    if (!req.session.otp || !req.session.tempUserData) {
        return res.redirect("/signup");
    }
    res.render("user/otp");
};

// --- AUTHENTICATION & GOOGLE FLOW ---

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

        const emailSent = await sendOTP(email, 'Verify your iZen Account', {
            title: "Welcome to iZen!",
            message: "Thank you for joining us. Use the following OTP to complete your registration and start exploring the world of Apple.",
            otp: otp
        });

        if (emailSent) {
            res.redirect("/verify-otp");
        } else {
            res.render("user/signup", {
                error: "Failed to send OTP. Please try again.",
            });
        }
    } catch (error) {
        console.error("Signup Error:", error);
        res.render("user/signup", {
            error: "An error occurred. Please try again.",
        });
    }
};

const handleLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await userService.findUserByEmail(email);

        if (!user) {
            return res.render("user/login", { error: "Email not found" });
        }

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

const handleGoogleCallback = (req, res) => {
    if (req.user.isBlocked) {
        req.logout((err) => {
            return res.redirect("/login?error=Your account is blocked");
        });
    } else {
        req.session.user = {
            id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            profileImage: req.user.profileImage || null
        };
        res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
        res.redirect("/");
    }
};

const handleLogout = (req, res) => {
    req.logout((err) => {
        req.session.destroy((err) => {
            if (err) console.log("Error destroying session:", err);
            res.clearCookie("connect.sid");
            res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
            res.redirect("/login");
        });
    });
};

// --- OTP & PASSWORD FLOWS ---

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

const resendOTP = async (req, res) => {
    try {
        const email = req.session.tempUserData ? req.session.tempUserData.email : 
                     (req.session.pendingEmailUpdate ? req.session.pendingEmailUpdate.newEmail : req.session.forgotPasswordEmail);
        
        if (!email) {
            return res.status(400).json({ success: false, message: "Session expired. Please try again." });
        }

        const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
        req.session.otp = newOtp;

        const emailSent = await sendOTP(email, 'New Verification Code', {
            title: "Your New OTP",
            message: "We received a request to resend your verification code. Use the code below to proceed.",
            otp: newOtp
        });

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

const handleForgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await userService.findUserByEmail(email);
        if (!user) return res.render("user/forgotEmail", { error: "No account found." });

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        req.session.forgotPasswordEmail = email; 
        req.session.otp = otp;

        await sendOTP(email, 'Reset Your Password', {
            title: "Security Verification",
            message: "A password reset was requested for your iZen account. Please enter the code below to set a new password.",
            otp: otp
        });

        res.redirect("/forgot-password-otp");
    } catch (error) {
        console.error("Forgot Password Error:", error);
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
        console.error("Reset Password Error:", error);
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
        console.error("Change Password Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// --- PROFILE & HOME ---

const loadHome = async (req, res) => {
    try {
        let user = req.session.user || null;
        if (user) {
            const dbUser = await User.findById(user.id || user._id);
            if (!dbUser || dbUser.isBlocked) {
                req.session.destroy();
                return res.redirect("/login");
            }
        }
        res.render("user/home", { user, newArrivals: [], inOffer: [], wishlist: null });
    } catch (err) {
        console.error("Home Load Error:", err);
        res.status(500).send("Internal Server Error");
    }
};

const loadProfile = async (req, res) => {
    try {
        const userData = req.session.user;
        if (!userData) return res.redirect("/login");

        const user = await userService.getUserById(userData.id || userData._id);

        if (!user || user.isBlocked) {
            req.session.destroy();
            return res.redirect("/login");
        }

        if (!user.addresses) user.addresses = [];
        res.render("user/profile", { user });
    } catch (error) {
        console.error("Profile Load Error:", error);
        res.status(500).render("user/profile", { user: null, message: "Could not load fresh profile data" });
    }
};

const getEditProfile = async (req, res) => {
    try {
        if (!req.session.user) return res.redirect("/login");
        const userId = req.session.user.id || req.session.user._id;
        const user = await userService.getUserById(userId);
        if (!user) return res.redirect("/profile");
        res.render("user/edit-profile", { user });
    } catch (error) {
        console.error("Error rendering edit profile:", error);
        res.redirect("/profile");
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const { username, phone, email } = req.body;
        const user = await userService.getUserById(userId);

        if (user.googleId && email !== user.email) {
            return res.status(400).json({ success: false, message: "Email cannot be changed for Google accounts." });
        }

        if (email !== user.email) {
            const emailTaken = await userService.isEmailTakenByAnother(email, userId);
            if (emailTaken) return res.status(400).json({ success: false, message: "This email is already in use." });

            const otp = Math.floor(1000 + Math.random() * 9000).toString();
            req.session.pendingEmailUpdate = { userId, newEmail: email, username, phone };
            req.session.otp = otp;

            const emailSent = await sendOTP(email, 'Verify New Email', {
                title: "Confirm Email Change",
                message: "You are attempting to change your account email to this one. Use the code below to verify ownership.",
                otp: otp
            });

            if (emailSent) {
                return res.json({ success: true, requiresOTP: true, message: "Verification code sent to your new email." });
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

const verifyEmailUpdateOTP = async (req, res) => {
    try {
        const { otp } = req.body;
        const pending = req.session.pendingEmailUpdate;

        if (!pending || otp !== req.session.otp) {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
        }

        await userService.updateUserEmail(pending.userId, pending.newEmail);
        await userService.updateUserDetails(pending.userId, { username: pending.username, phone: pending.phone });

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

const updateAvatar = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });
        const userId = req.session.user.id || req.session.user._id;
        const imagePath = `uploads/profile/${req.file.filename}`;
        await userService.updateProfileImage(userId, imagePath);
        req.session.user.image = imagePath;
        req.session.save((err) => {
            if (err) return res.status(500).json({ success: false, message: 'Error saving session' });
            res.json({ success: true, message: 'Profile picture updated!', path: imagePath });
        });
    } catch (error) {
        console.error("Avatar Upload Error:", error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const removeAvatar = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        await User.updateOne({ _id: userId }, { $set: { profileImage: null } });
        req.session.user.image = null;
        req.session.save((err) => {
            if (err) return res.status(500).json({ success: false });
            res.json({ success: true, message: "Profile picture removed" });
        });
    } catch (error) {
        console.error("Remove Avatar Error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// --- ADDRESS MANAGEMENT ---

const loadAddressPage = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const user = await userService.getUserById(userId);
        res.render("user/address", { user, addresses: user.addresses || [] });
    } catch (error) {
        console.error("Load Address Error:", error);
        res.status(500).send("Error loading addresses");
    }
};

const addAddress = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
        const { fullname, addressType, address, city, pincode, phone } = req.body;
        await userService.addAddress(userId, { fullname, addressType, address, city, pincode, phone });
        res.json({ success: true, message: "Address added successfully" });
    } catch (error) {
        console.error("Add Address Error:", error);
        res.status(500).json({ success: false, message: "Error adding address" });
    }
};

const getEditAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user.id || req.session.user._id;
        const user = await User.findById(userId);
        const address = user.addresses.find(addr => addr._id.toString() === addressId);
        if (!address) return res.redirect('/address'); 
        res.render('user/editaddress', { user, address });
    } catch (error) {
        console.error("Error fetching address:", error);
        res.redirect('/address');
    }
};

const postEditAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user.id || req.session.user._id;
        const { fullname, phone, address, city, pincode, addressType } = req.body;
        const result = await User.updateOne(
            { _id: userId, "addresses._id": addressId },
            { $set: { "addresses.$": { fullname, phone, address, city, pincode, addressType } } }
        );
        if (result.modifiedCount > 0) {
            res.json({ success: true, message: "Address updated successfully" });
        } else {
            res.status(400).json({ success: false, message: "No changes made or address not found" });
        }
    } catch (error) {
        console.error("Update Address Error:", error);
        res.status(500).json({ success: false, message: "Update Failed" });
    }
};

const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user.id || req.session.user._id;
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
        res.json({ success });
    } catch (error) {
        console.error("Set Default Error:", error);
        res.status(500).json({ success: false });
    }
};

module.exports = {
    getSignupPage,
    getLoginPage,
    getForgotEmailPage,
    getForgotOtpPage,
    getResetPasswordPage,
    getSignupOtpPage,
    handleSignup,
    handleLogin,
    handleGoogleCallback,
    handleLogout,
    verifyOTP,
    resendOTP,
    handleForgotPassword,
    handleResetPassword,
    changePassword,
    loadHome,
    loadProfile,
    getEditProfile,
    updateProfile,
    verifyEmailUpdateOTP,
    updateAvatar,
    removeAvatar,
    loadAddressPage,
    addAddress,
    getEditAddress,
    postEditAddress,
    deleteAddress,
    handleSetDefaultAddress
};