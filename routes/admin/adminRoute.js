const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin/admincontroller');
const middleware = require('../../middlewares/adminAuth'); 

// --- ADMIN AUTH ---
router.route('/login')
    .get(middleware.hasSession, adminController.loadLogin)
    .post(adminController.loginVerify);

router.get('/', (req, res) => {
    res.redirect('/admin/userManagement');
});

router.get('/logout', adminController.logout);

// --- USER MANAGEMENT ---
router.get('/userManagement', middleware.checkSession, adminController.loadUsers);
router.post('/searchUser', middleware.checkSession, adminController.searchUser);

// --- ADD USER ---
router.get('/addUser', middleware.checkSession, adminController.addUserPage);
router.post('/addUser', middleware.checkSession, adminController.addUser);

// --- STATUS UPDATES ---
// We use PATCH for partial updates like blocking/unblocking
router.patch('/blockUser', middleware.checkSession, adminController.blockUser);
router.patch('/unBlockUser', middleware.checkSession, adminController.unBlockUser);

// --- DASHBOARD ---
router.get('/dashboard', middleware.checkSession, adminController.loadDashboard);
router.get('/dashboard-filter', middleware.checkSession, adminController.getFilterData);

module.exports = router;