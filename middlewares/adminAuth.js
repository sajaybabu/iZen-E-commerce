const checkSession = (req, res, next) => {
    if (req.session && req.session.admin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

const hasSession = (req, res, next) => {
    if (req.session && req.session.admin) {
        return res.redirect('/admin/userManagement');
    }
    next();
};

module.exports = {
    checkSession,
    hasSession
};