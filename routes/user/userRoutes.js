const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../../controllers/user/userController");
// 1. CHANGE THIS LINE: Swap out the deleted file for your true controller
const userProductController = require("../../controllers/user/userProductController");
const wishlistController = require('../../controllers/user/wishlistController');
const upload = require('../../config/multer'); 
const { isLogin, isLogout } = require("../../middlewares/auth");

// --- HOME ---
router.get("/", userController.loadHome); 

// --- SHOP / PRODUCTS ---
// 2. CHANGE THIS LINE: Use userProductController instead of allProductController
router.get("/allProducts", userProductController.getAllProductsPage);

// --- GOOGLE AUTH ---
router.get("/auth/google", isLogout, passport.authenticate("google", { scope: ["profile", "email"], prompt: "select_account" }));
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), userController.handleGoogleCallback);

// --- SIGNUP ---
router.get("/signup", isLogout, userController.getSignupPage);
router.post("/signup", isLogout, userController.handleSignup);
router.get("/verify-otp", isLogout, userController.getSignupOtpPage);
router.post("/verify-otp", isLogout, userController.verifyOTP);
router.post("/resend-otp", isLogout, userController.resendOTP);

// --- LOGIN & LOGOUT ---
router.get("/login", isLogout, userController.getLoginPage);
router.post("/login", isLogout, userController.handleLogin);
router.get("/logout", userController.handleLogout);

// --- FORGOT PASSWORD ---
router.get("/forgot-password", isLogout, userController.getForgotEmailPage); 
router.post("/forgot-password", isLogout, userController.handleForgotPassword);
router.get("/forgot-password-otp", isLogout, userController.getForgotOtpPage);
router.post("/forgot-password-otp", isLogout, userController.verifyOTP); 
router.post("/resend-forgot-otp", isLogout, userController.resendOTP);
router.get("/changePassword", isLogout, userController.getResetPasswordPage);
router.post("/changePassword", isLogout, userController.handleResetPassword); 
router.post('/change-password', isLogin, userController.changePassword);

// --- PROFILE & AVATAR ---
router.get('/profile', isLogin, userController.loadProfile);
router.post('/user/update-avatar', isLogin, upload.single('profileImage'), userController.updateAvatar);
router.post('/remove-avatar', isLogin, userController.removeAvatar);

// --- EDIT PROFILE ---
router.get('/edit-profile', isLogin, userController.getEditProfile);
router.post('/edit-profile', isLogin, userController.updateProfile);
router.post('/verify-email-otp', isLogin, userController.verifyEmailUpdateOTP);

// --- ADDRESS MANAGEMENT ---
router.get('/address', isLogin, userController.loadAddressPage);
router.post('/add-address', isLogin, userController.addAddress);
router.get('/edit-address/:id', isLogin, userController.getEditAddress);
router.post('/edit-address/:id', isLogin, userController.postEditAddress);
router.post('/set-default-address', isLogin, userController.handleSetDefaultAddress);
router.delete('/delete-address/:id', isLogin, userController.deleteAddress);
router.get('/delete-address/:id', isLogin, userController.deleteAddress); 

// Wishlist Routing Interface
router.get('/wishlist', wishlistController.getWishlistPage);
router.post('/wishlist/add', wishlistController.addToWishlist);
router.post('/wishlist/moveAllToCart', wishlistController.moveAllToCart);
router.delete('/wishlist/remove/:productId', wishlistController.removeFromWishlist);

module.exports = router;