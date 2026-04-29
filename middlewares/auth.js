// Prevents unauthenticated users from accessing private routes
const isLogin = (req, res, next) => {
    // Force the browser to not cache protected pages
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (req.session.user) {
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
        // Apply headers here too so login/signup pages aren't cached 
        // and shown incorrectly after a logout
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