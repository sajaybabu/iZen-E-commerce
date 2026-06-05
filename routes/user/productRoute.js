const express = require('express');
const router = express.Router();
// Changed from allProductController to your permanent controller asset
const userProductController = require('../../controllers/user/userProductController');

// Binds the shop listing grid route safely
router.get('/allProducts', userProductController.getAllProductsPage);

// Binds the secure product details route handling stock checks and redirects
router.get('/productDetail/:id', userProductController.getProductDetailPage);

module.exports = router;