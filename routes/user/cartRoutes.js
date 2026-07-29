const express = require('express');
const router = express.Router();
const cartController = require('../../controllers/user/cartController');
const { isLogin } = require('../../middlewares/auth'); 

router.get('/', isLogin, cartController.getCartPage);

// Add Product Variant to Cart
router.post('/add', isLogin, cartController.addToCart);

// Increment / Decrement Quantity 
router.put('/update-quantity', isLogin, cartController.updateQuantity);

// Remove Variant completely
router.delete('/remove/:variantId', isLogin, cartController.removeProduct);
module.exports = router;