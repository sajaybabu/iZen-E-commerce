// Prevents unauthenticated users from accessing private routes
const isLogin = (req, res, next) => {
    if (req.session.user) {
        // Force the browser to not cache protected pages
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        next();
    } else {
        res.redirect('/login');
    }
};

// Prevents logged-in users from seeing Login/Signup/OTP pages again
const isLogout = (req, res, next) => {
    if (req.session.user) {
        return res.redirect('/');
    } else {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
        next();
    }
};

module.exports = {
    isLogin,
    isLogout
};