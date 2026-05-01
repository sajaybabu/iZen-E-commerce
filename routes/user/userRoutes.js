const express = require("express");
const router = express.Router();
const passport = require("passport");
const userController = require("../../controllers/user/userController");
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
      // Set the session user
      req.session.user = req.user;

      // Ensure the browser doesn't "store" this callback URL in its history
      res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
      
      // Redirect to home
      res.redirect("/");
    }
  },
);

// --- SIGNUP ---
router.get("/signup", isLogout, userController.getSignupPage);
router.post("/signup", isLogout, userController.handleSignup);

// --- OTP ---
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

// --- LOGOUT ---
router.get("/logout", (req, res) => {
  // Clear the session and the passport user
  req.logout((err) => {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session:", err);
      }
      res.clearCookie("connect.sid"); // Clear the session cookie
      
      // Force no-cache on the redirect to login
      res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
      res.redirect("/login");
    });
  });
});

// --- HOME ---
router.get("/", isLogin, (req, res) => {
  res.render("user/home", { user: req.session.user });
});

module.exports = router;
