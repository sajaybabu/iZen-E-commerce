const isLogin = (req, res, next) => {
    // Prevent browser caching for authenticated routes
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    // Check custom session user OR Passport user (Google OAuth)
    if (req.session?.user || req.user) {
        console.log(`   ✅ SUCCESS: Authorized access granted. Proceeding to controller...`);
        return next();
    }

    // Redirect admin trying to access user routes
    if (req.session?.admin) {
        console.log(`   ⚠️ REDIRECT: Admin user detected on user route. Forwarding to /admin/dashboard...`);
        return res.redirect('/admin/dashboard');
    }

    console.log(` DENIED: Unauthenticated request. Redirecting to /login...`);
    return res.redirect('/login');
};

// Prevents logged-in users from accessing Auth pages (Login, Signup, OTP)
const isLogout = (req, res, next) => {
    console.log(`\n🔍 [isLogout Middleware] Intercepted Request: ${req.method} ${req.originalUrl}`);
    console.log(`   ├─ req.session.user:`, req.session?.user);
    console.log(`   └─ req.user (Passport):`, req.user ? req.user._id : undefined);

    if (req.session?.user || req.user) {
        console.log(`   ⚠️ REDIRECT: User already logged in. Blocking access to auth page and sending to / ...`);
        return res.redirect('/');
    } else {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        console.log(`   ✅ PASS: Visitor is guest. Displaying requested page...`);
        return next();
    }
};

module.exports = {
    isLogin,
    isLogout
};