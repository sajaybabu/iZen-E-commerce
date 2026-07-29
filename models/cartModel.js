const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        productId: { // 🌟 ADD THIS FIELD HERE
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Variant', 
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            max: 5 
        }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);









/*const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Variant', // Points to the variant document
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1,
            max: 5 // Enforces your iZen cap of 5 units limit natively
        }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema); */