const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin/admincontroller');
const middleware = require('../../middlewares/adminAuth'); 

// ADMIN AUTH
 
router.route('/login')
    .get(middleware.hasSession, adminController.loadLogin)
    .post(adminController.loginVerify);

router.get('/dashboard', middleware.checkSession, adminController.loadDashboard);
router.get('/logout', adminController.logout);

//  USER MANAGEMENT

//Load users with Pagination 
router.get('/userManagement', middleware.checkSession, adminController.loadUsers);
router.get('/userManagement/:page', middleware.checkSession, adminController.loadUsers);

//Search 
router.post('/searchUser', middleware.checkSession, adminController.searchUser);

// Block/Unblock 
router.patch('/blockUser', middleware.checkSession, adminController.blockUser);
router.patch('/unBlockUser', middleware.checkSession, adminController.unBlockUser);

module.exports = router;