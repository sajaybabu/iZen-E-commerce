const express = require('express');
const router = express.Router();
const checkoutController = require('../../controllers/user/checkoutController');

// Main view routes
router.get('/', checkoutController.getCheckoutPage);
router.get('/order-success', checkoutController.getOrderSuccessPage);


router.get('/orders/my-orders', checkoutController.getMyOrdersPage);

router.get('/orders/:id', checkoutController.getOrderDetailsPage);

// Form mutation endpoints
router.post('/add-address', checkoutController.editAddress);
router.patch('/select-address', checkoutController.selectAddress);
router.patch('/edit-address', checkoutController.editAddress);
router.post('/place-order', checkoutController.placeOrder); 

router.post('/orders/cancel-item', checkoutController.cancelOrderItem);
router.post('/orders/return-item', checkoutController.returnOrderItem);
router.post('/orders/cancel-all', checkoutController.cancelAllOrderItems);
router.post('/orders/return-all', checkoutController.returnAllOrderItems);

router.get('/orders/:id/invoice', checkoutController.downloadInvoice);

router.post('/create-razorpay-order', checkoutController.createRazorpayOrder);
router.post('/verify-razorpay-payment', checkoutController.verifyRazorpayPayment);
router.get('/payment-failure', checkoutController.getPaymentFailurePage);

module.exports = router;