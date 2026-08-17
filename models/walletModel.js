const mongoose = require('mongoose');


const walletTransactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        default: () => `WTX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    purpose: {
        type: String,
        enum: ['Order Cancellation', 'Order Return', 'Purchase Payment', 'Admin Adjustment', 'Referral Bonus'],
        required: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    description: {
        type: String,
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    transactions: [walletTransactionSchema]
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);