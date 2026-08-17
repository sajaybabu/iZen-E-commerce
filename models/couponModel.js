const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    discountType: {
        type: String,
        enum: ['percentage', 'fixed'],
        required: true
    },
    discountValue: {
        type: Number,
        required: true
    },
    minOrderAmount: {
        type: Number,
        default: 0
    },
    maxDiscountAmount: {
        type: Number,
        default: null
    },
    expiryDate: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isNewUserOnly: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);