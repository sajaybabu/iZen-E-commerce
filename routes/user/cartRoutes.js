// routes/user/cartRoutes.js
const express = require('express');
const router = express.Router();
const cartController = require('../../controllers/user/cartController');
const { isLogin } = require('../../middlewares/auth'); 

// View Cart Interface Page
router.get('/', isLogin, cartController.getCartPage);

// Add Product Variant to Cart
router.post('/add', isLogin, cartController.addToCart);

// Increment / Decrement Quantity via AJAX
router.put('/update-quantity', isLogin, cartController.updateQuantity);

// Evict/Remove Variant from Ecosystem completely
router.delete('/remove/:variantId', isLogin, cartController.removeProduct);

router.get('/checkout', isLogin, cartController.getCheckoutPage);

module.exports = router;