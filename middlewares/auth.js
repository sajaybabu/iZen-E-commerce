const isLogin = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (req.session.user) {
        console.log("✅ Check passed: User session detected. Moving to controller...");
        return next();
    }

    // IF an admin attempts to load user profile/cart pages, redirect safely
    if (req.session.admin) {
        return res.redirect('/admin/dashboard');
    }
    res.redirect('/login');
};

// Prevents logged-in users from seeing Login/Signup/OTP pages again
const isLogout = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/');
    } else {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        next();
    }
};

module.exports = {
    isLogin,
    isLogout
};