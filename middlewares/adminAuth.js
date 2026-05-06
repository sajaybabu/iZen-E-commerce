const checkSession = (req, res, next) => {
    // Force the browser to verify with the server every time
    // This prevents seeing the admin panel after logout via the back button
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    if (req.session && req.session.admin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
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