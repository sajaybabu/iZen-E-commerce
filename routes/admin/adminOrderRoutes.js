const express = require('express');
const router = express.Router();

const adminOrderController = require('../../controllers/admin/adminOrderController');
const middleware = require('../../middlewares/adminAuth'); 

router.get('/admin/orders', middleware.checkSession, adminOrderController.getAllOrders);
router.get('/admin/orders/:id', middleware.checkSession, adminOrderController.getOrderDetails);

router.patch('/admin/orders/update-item-status', middleware.checkSession, adminOrderController.updateItemStatus);

module.exports = router;