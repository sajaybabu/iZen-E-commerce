const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const middleware = require('../middlewares/adminAuth');

// 1. User Management Main Page
router.route('/')
    .get(middleware.checkSession, customerController.loadUserManagement);

// 2. Block & Unblock 
router.route('/blockUser')
    .patch(middleware.checkSession, customerController.blockUser);

router.route('/unBlockUser')
    .patch(middleware.checkSession, customerController.unBlockUser);

// 3. Pagination
router.route('/page/:page')
    .get(middleware.checkSession, customerController.pagination);

// 4. Search
router.route('/search')
    .post(middleware.checkSession, customerController.searchUser);

module.exports = router;