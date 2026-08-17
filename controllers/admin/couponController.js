const couponService = require('../../services/admin/couponService');

exports.loadCoupons = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const search = req.query.search || '';

        const result = await couponService.getCoupons(page, search);

        res.render('admin/couponManagement', {
            coupons: result.coupons,
            currentPage: page,
            totalPages: result.totalPages,
            search
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading coupons page');
    }
};

exports.addCoupon = async (req, res) => {
    try {
        await couponService.createCoupon(req.body);
        return res.status(201).json({
            success: true,
            message: 'Coupon created successfully!'
        });
    } catch (error) {
        console.error(error);
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to create coupon.'
        });
    }
};

exports.deleteCoupon = async (req, res) => {
    try {
        const deleted = await couponService.deleteCoupon(req.params.id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: 'Coupon record not found.'
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Coupon removed successfully.'
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Server error while deleting coupon.'
        });
    }
};