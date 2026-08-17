const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../../controllers/admin/adminAuthController');
const customerController = require('../../controllers/admin/customerController');
const categoryController = require('../../controllers/admin/categoryController');
const productController = require('../../controllers/admin/productController');
const couponController = require('../../controllers/admin/couponController');
const offerController = require('../../controllers/admin/offerController');
const salesReportController = require('../../controllers/admin/salesReportController'); // <-- Added
const upload = require('../../config/upload');

const middleware = require('../../middlewares/adminAuth'); 

// --- ADMIN AUTH & DASHBOARD ---
router.get('/', middleware.checkSession, (req, res) => res.redirect('/admin/userManagement'));

router.route('/login')
    .get(middleware.hasSession, authController.loadLogin)
    .post(authController.loginVerify);

router.get('/logout', authController.logout);
router.get('/dashboard', middleware.checkSession, authController.loadDashboard);

// --- USER (CUSTOMER) MANAGEMENT ---
router.get('/userManagement', middleware.checkSession, customerController.loadUsers);
router.post('/searchUser', middleware.checkSession, customerController.searchUser);

// --- ADD USER ---
router.get('/addUser', middleware.checkSession, customerController.addUserPage);
router.post('/addUser', middleware.checkSession, customerController.addUser);

// --- STATUS UPDATES ---
router.patch('/blockUser', middleware.checkSession, customerController.blockUser);
router.patch('/unBlockUser', middleware.checkSession, customerController.unBlockUser);

// --- CATEGORY MANAGEMENT ---
router.get('/category', middleware.checkSession, categoryController.loadCategories);
router.get('/addCategory', middleware.checkSession, categoryController.loadAddCategory);
router.post('/addCategory', middleware.checkSession, categoryController.addCategory);

router.get('/editCategory/:id', middleware.checkSession, categoryController.loadEditCategory);
router.post('/editCategory/:id', middleware.checkSession, categoryController.updateCategory);
router.delete('/deleteCategory', middleware.checkSession, categoryController.deleteCategory);

// --- PRODUCT MANAGEMENT ---
router.get('/products', middleware.checkSession, productController.getAllProducts);
router.get('/products/add', middleware.checkSession, productController.getAddProductPage);
router.post('/products/add', middleware.checkSession, upload.any(), productController.createProduct);
router.delete('/deleteProduct/:id', middleware.checkSession, productController.deleteProduct);
router.post('/searchProduct', middleware.checkSession, productController.searchProducts);
router.get('/editProduct/:id', middleware.checkSession, productController.getEditProductPage);
router.post('/updateProduct/:id', middleware.checkSession, upload.any(), productController.updateProduct);
router.patch('/blockCategory', middleware.checkSession, categoryController.blockCategory);
router.patch('/unBlockCategory', middleware.checkSession, categoryController.unBlockCategory);   

// --- COUPON MANAGEMENT ---
router.get('/coupons', middleware.checkSession, couponController.loadCoupons);
router.post('/coupons/add', middleware.checkSession, couponController.addCoupon);
router.delete('/coupons/delete/:id', middleware.checkSession, couponController.deleteCoupon);

// --- OFFER MODULE ---
router.get('/offers', middleware.checkSession, offerController.loadOffersPage);
router.patch('/offers/product', middleware.checkSession, offerController.updateProductOffer);
router.patch('/offers/category', middleware.checkSession, offerController.updateCategoryOffer);
router.patch('/offers/referral', middleware.checkSession, offerController.updateReferralOffer);

// --- SALES REPORT MODULE ---
router.get('/salesReport', middleware.checkSession, salesReportController.loadSalesReport);
router.get('/salesReport/excel', middleware.checkSession, salesReportController.downloadExcelReport);
router.get('/salesReport/pdf', middleware.checkSession, salesReportController.downloadPdfReport);

module.exports = router;