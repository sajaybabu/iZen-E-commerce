const Coupon = require('../../models/couponModel');

const getCoupons = async (page = 1, search = '') => {
    const limit = 5;
    const skip = (page - 1) * limit;

    const query = {};
    if (search.trim()) {
        query.code = { $regex: search.trim(), $options: 'i' };
    }

    const count = await Coupon.countDocuments(query);
    const coupons = await Coupon.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    return {
        coupons,
        totalPages: Math.ceil(count / limit) || 1
    };
};

const createCoupon = async (couponData) => {
    const {
        code,
        discountType,
        discountValue,
        minOrderAmount,
        maxDiscountAmount,
        expiryDate,
        isNewUserOnly
    } = couponData;

    const cleanCode = code.trim().toUpperCase();

    const existing = await Coupon.findOne({ code: cleanCode });
    if (existing) {
        throw new Error('Coupon code already exists.');
    }

    if (discountType === 'percentage') {
        const value = Number(discountValue);
        if (value <= 0 || value > 100) {
            throw new Error('Percentage discount must be between 1 and 100.');
        }
        if (!maxDiscountAmount || Number(maxDiscountAmount) <= 0) {
            throw new Error('Please specify a valid maximum discount limit for percentage coupons.');
        }
    }

    if (discountType === 'fixed' && Number(discountValue) <= 0) {
        throw new Error('Fixed discount value must be greater than zero.');
    }

    if (new Date(expiryDate) <= new Date()) {
        throw new Error('Expiry date must be set to a future date.');
    }

    const newCoupon = new Coupon({
        code: cleanCode,
        discountType,
        discountValue: Number(discountValue),
        minOrderAmount: Number(minOrderAmount) || 0,
        maxDiscountAmount: discountType === 'percentage' ? Number(maxDiscountAmount) : null,
        expiryDate: new Date(expiryDate),
        isNewUserOnly: isNewUserOnly === 'true' || isNewUserOnly === true
    });

    return await newCoupon.save();
};

const deleteCoupon = async (id) => {
    return await Coupon.findByIdAndDelete(id);
};

module.exports = {
    getCoupons,
    createCoupon,
    deleteCoupon
};