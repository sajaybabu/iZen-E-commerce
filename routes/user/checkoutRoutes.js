const express = require('express');
const router = express.Router();
const checkoutController = require('../../controllers/user/checkoutController');

// Main view routes
router.get('/', checkoutController.getCheckoutPage);
router.get('/order-success', checkoutController.getOrderSuccessPage);


router.get('/orders/my-orders', checkoutController.getMyOrdersPage);

router.get('/orders/:id', checkoutController.getOrderDetailsPage);

// Form mutation endpoints
router.patch('/select-address', checkoutController.selectAddress);
router.patch('/edit-address', checkoutController.editAddress);
router.post('/place-order', checkoutController.placeOrder); 

router.post('/orders/cancel-item', checkoutController.cancelOrderItem);
router.post('/orders/return-item', checkoutController.returnOrderItem);

router.get('/orders/:id/invoice', checkoutController.downloadInvoice);

module.exports = router;