const express = require('express');
const router = express.Router();
const customerController = require('../../controllers/admin/customerController');
const middleware = require('../../middlewares/adminAuth');

// User Management Main Page
router.route('/')
    .get(middleware.checkSession, customerController.loadUserManagement);

//  Block & Unblock 
router.route('/blockUser')
    .patch(middleware.checkSession, customerController.blockUser);

router.route('/unBlockUser')
    .patch(middleware.checkSession, customerController.unBlockUser);

//  Pagination
router.route('/page/:page')
    .get(middleware.checkSession, customerController.pagination);

// Search
router.route('/search')
    .post(middleware.checkSession, customerController.searchUser);

module.exports = router;