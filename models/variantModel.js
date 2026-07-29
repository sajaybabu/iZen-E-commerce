const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product', 
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
    quantity: { 
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

