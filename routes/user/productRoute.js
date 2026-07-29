const express = require('express');
const router = express.Router();
const userProductController = require('../../controllers/user/userProductController');


router.get('/allProducts', userProductController.getAllProductsPage);
router.get('/productDetail/:id', userProductController.getProductDetailPage);

module.exports = router;