const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    referrerReward: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    refereeReward: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Referral', referralSchema);