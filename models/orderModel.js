const mongoose = require('mongoose');

// function to generate a unique, clean order ID 
const generateOrderId = () => {
    const prefix = 'iZEN';
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}${random}`;
};

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        required: true,
        unique: true,
        default: generateOrderId
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: { type: String, required: true },
        variantId: { type: String, required: true }, // Embedded variant array ID reference
        variantColor: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
        // Item level status tracking allows specific products to be cancelled/returned
        status: {
            type: String,
            enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled', 'Returned', 'Cancel Requested', 'Return Request Pending'],
            default: 'Pending'
        },
        cancellationReason: { type: String, default: null },
        returnReason: { type: String, default: null }
    }],
    shippingAddress: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        addressLine: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true }
    },
    paymentMethod: {
        type: String,
        enum: ['COD', 'Online', 'Wallet', 'Razorpay'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true }
}, { timestamps: true });

// Indexing for rapid order searching
orderSchema.index({ orderId: 1, user: 1 });

module.exports = mongoose.model('Order', orderSchema);