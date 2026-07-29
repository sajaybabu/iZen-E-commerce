const checkSession = (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // If an active admin session is found, proceed
    if (req.session && req.session.admin) {
        return next();
    } 
    
    // IF a customer attempts to access an admin page, reject them
    if (req.session && req.session.user) {
        return res.redirect('/'); // Take them back to user home
    }

    res.redirect('/admin/login');
};

const hasSession = (req, res, next) => {
    if (req.session && req.session.admin) {
        // If already logged in, push them to the management page
        return res.redirect('/admin/userManagement');
    }

    // Ensure login page isn't cached so back-button doesn't show it 

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    next();
};

module.exports = {
    checkSession,
    hasSession
};