const adminAuthService = require('../../services/admin/adminAuthService');

const loadLogin = async (req, res) => {
    res.render('admin/login');
};

const loginVerify = async (req, res) => {
    try {

        const { email, password } = req.body;

        const admin =
            await adminAuthService.verifyAdminLogin(
                email,
                password
            );

        if (!admin) {
            return res.status(401).json({
                success: false,
                message: "Invalid Credentials"
            });
        }

        req.session.admin = admin._id;

        return res.json({
            success: true,
            redirectUrl: '/admin/userManagement'
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false
        });
    }
};

const logout = (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.redirect('/admin/login');
    });
};

const loadDashboard = (req, res) => {
    res.render('admin/dashboard');
};

module.exports = {
    loadLogin,
    loginVerify,
    logout,
    loadDashboard
};