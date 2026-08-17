const express = require("express");
const router = express.Router();
const passport = require("passport");

// Controllers
const userController = require("../../controllers/user/userController");
const userProductController = require("../../controllers/user/userProductController");
const wishlistController = require('../../controllers/user/wishlistController');
const walletController = require('../../controllers/user/walletController');

// Middlewares & Config
const upload = require('../../config/multer'); 
const { isLogin, isLogout } = require("../../middlewares/auth");

//  PUBLIC ROUTES (HOME & STORE)
router.get("/", userController.loadHome); 
router.get("/allProducts", userProductController.getAllProductsPage);

//  GOOGLE AUTHENTICATION
router.get("/auth/google", isLogout, passport.authenticate("google", { scope: ["profile", "email"], prompt: "select_account" }));
router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), userController.handleGoogleCallback);

//  AUTHENTICATION (SIGNUP, LOGIN, LOGOUT)
router.get("/signup", isLogout, userController.getSignupPage);
router.post("/signup", isLogout, userController.handleSignup);

// OTP Verification (Keep lightweight auth check so temp session isn't killed)
router.get("/verify-otp", userController.getSignupOtpPage);
router.post("/verify-otp", userController.verifyOTP);
router.post("/resend-otp", userController.resendOTP);

router.get("/login", isLogout, userController.getLoginPage);
router.post("/login", isLogout, userController.handleLogin);
router.get("/logout", userController.handleLogout);

//  FORGOT & RESET PASSWORD
router.get("/forgot-password", isLogout, userController.getForgotEmailPage); 
router.post("/forgot-password", isLogout, userController.handleForgotPassword);
router.get("/forgot-password-otp", userController.getForgotOtpPage);
router.post("/forgot-password-otp", userController.verifyOTP); 
router.post("/resend-forgot-otp", userController.resendOTP);
router.get("/changePassword", userController.getResetPasswordPage);
router.post("/changePassword", userController.handleResetPassword); 

// Authenticated Password Change (From Profile)
router.post('/change-password', isLogin, userController.changePassword);

//  USER PROFILE & AVATAR MANAGEMENT
router.get('/profile', isLogin, userController.loadProfile);
router.post('/user/update-avatar', isLogin, upload.single('profileImage'), userController.updateAvatar);
router.post('/remove-avatar', isLogin, userController.removeAvatar);

router.get('/edit-profile', isLogin, userController.getEditProfile);
router.post('/edit-profile', isLogin, userController.updateProfile);
router.post('/verify-email-otp', isLogin, userController.verifyEmailUpdateOTP);

//  ADDRESS MANAGEMENT
router.get('/address', isLogin, userController.loadAddressPage);
router.post('/add-address', isLogin, userController.addAddress);
router.get('/edit-address/:id', isLogin, userController.getEditAddress);
router.post('/edit-address/:id', isLogin, userController.postEditAddress);
router.post('/set-default-address', isLogin, userController.handleSetDefaultAddress);
router.delete('/delete-address/:id', isLogin, userController.deleteAddress);
router.get('/delete-address/:id', isLogin, userController.deleteAddress); 

//  WISHLIST ROUTES 
router.get('/wishlist', isLogin, wishlistController.getWishlistPage);
router.post('/wishlist/add', isLogin, wishlistController.addToWishlist);
router.post('/wishlist/moveAllToCart', isLogin, wishlistController.moveAllToCart);
router.delete('/wishlist/remove/:productId', isLogin, wishlistController.removeFromWishlist);

//  WALLET ROUTES 
router.get('/wallet', isLogin, walletController.getWalletPage);

module.exports = router;