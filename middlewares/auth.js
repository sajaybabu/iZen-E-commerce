//  Prevents unauthenticated users from accessing private routes
const isLogin = (req, res, next) => {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
};

//  Prevents logged-in users from seeing Login/Signup pages again
const isLogout = (req, res, next) => {
    if (req.session.user) {
        res.redirect('/');
    } else {
        next();
    }
};

module.exports = {
    isLogin,
    isLogout
};