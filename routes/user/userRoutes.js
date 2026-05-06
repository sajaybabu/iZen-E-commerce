const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../../controllers/user/userController");
const upload = require('../../config/multer'); 
const { isLogin, isLogout } = require("../../middlewares/auth");

// --- GOOGLE AUTH ---
router.get(
  "/auth/google",
  isLogout,
  passport.authenticate("google", { scope: ["profile", "email"], prompt: "select_account" }),
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
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
  },
);

// --- SIGNUP ---
router.get("/signup", isLogout, userController.getSignupPage);
router.post("/signup", isLogout, userController.handleSignup);

// --- FORGOT PASSWORD FLOW ---
//  Page to enter email
router.get("/forgot-password", isLogout, (req, res) => res.render("user/forgotEmail")); 
router.post("/forgot-password", isLogout, userController.handleForgotPassword);

// OTP Verification for Forgot Password
router.get("/forgot-password-otp", isLogout, (req, res) => res.render("user/forgotPassOtp"));
router.post("/forgot-password-otp", isLogout, userController.verifyOTP); 
router.post("/resend-forgot-otp", isLogout, userController.resendOTP);

// Password page
router.get("/changePassword", isLogout, (req, res) => res.render("user/changePassword"));

router.post("/changePassword", isLogout, userController.handleResetPassword); 

// --- PROFILE & AVATAR ---
router.get('/profile', isLogin, userController.loadProfile);
router.post('/user/update-avatar', isLogin, upload.single('profileImage'), userController.updateAvatar);

// --- OTP (Signup) ---
router.get("/verify-otp", isLogout, (req, res) => {
  if (!req.session.otp || !req.session.tempUserData) {
    return res.redirect("/signup");
  }
  res.render("user/otp");
});
router.post("/verify-otp", isLogout, userController.verifyOTP);
router.post("/resend-otp", isLogout, userController.resendOTP);

// --- LOGIN ---
router.get("/login", isLogout, userController.getLoginPage);
router.post("/login", isLogout, userController.handleLogin);

// --- ADDRESS MANAGEMENT ---
router.get('/address', isLogin, userController.loadAddressPage);
router.post('/add-address', isLogin, userController.addAddress);
router.get('/edit-address/:id', isLogin, userController.getEditAddress);
router.post('/edit-address/:id', isLogin, userController.postEditAddress);
router.post('/set-default-address', isLogin, userController.handleSetDefaultAddress);

// Supported both DELETE (for API/Fetch) and GET (for simple links)
router.delete('/delete-address/:id', isLogin, userController.deleteAddress);
router.get('/delete-address/:id', isLogin, userController.deleteAddress); 

// --- LOGOUT ---
router.get("/logout", (req, res) => {
  req.logout((err) => {
    req.session.destroy((err) => {
      if (err) console.log("Error destroying session:", err);
      res.clearCookie("connect.sid");
      res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
      res.redirect("/login");
    });
  });
});

// --- HOME ---
router.get("/", userController.loadHome); 

module.exports = router;