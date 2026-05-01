const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/admin/admincontroller');
const middleware = require('../../middlewares/adminAuth'); // We will create this next
const customerRoute = require("./customerRoute"); // For user management

// --- ADMIN AUTH ---
router.route('/login')
    .get(middleware.hasSession, adminController.loadLogin)
    .post(adminController.loginVerify);

router.route('/dashboard')
    .get(middleware.checkSession, adminController.loadDashboard);

router.route('/logout')
    .get(adminController.logout);

// This handles block/unblock, search, and pagination for users
router.use('/users', customerRoute); 

module.exports = router;