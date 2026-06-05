const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product', // Points to the main product (e.g., iPhone 15 Pro)
        required: true
    },
    ram: {
        type: String,
        required: true
    },
    storage: {
        type: String,
        required: true
    },
    color: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    quantity: { // This is your warehouse stock level
        type: Number,
        required: true,
        min: 0
    },
    images: {
        type: [String],
        default: []
    }
}, { timestamps: true });

module.exports = mongoose.model('Variant', variantSchema);