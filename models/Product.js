const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Product name is required'],
        trim: true
    },
    description: {
        type: String,
        required: [true, 'Description is required']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['iPhone', 'iPad', 'MacBook', 'Macbook', 'Apple Watch', 'AirPods'] 
    },
    price: {
        type: Number,
        default: 0
    },
    stock: {
        type: Number,
        default: 0
    },
    isBlocked: {
        type: Boolean,
        default: false 
    },
    isDeleted: { 
        type: Boolean,
        default: false
    },
    images: {
        type: [String],
        validate: {
            validator: function(array) {
                return array && array.length >= 3;
            },
            message: 'A product must have a minimum of 3 images.'
        }
    },
    variants: [{
        price: {
            type: Number,
            required: [true, 'Variant price is required'],
            min: 0
        },
        quantity: {
            type: Number,
            required: [true, 'Variant stock quantity is required'],
            min: 0,
            default: 0
        },
        attributes: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        images: {
            type: [String],
            default: []
        }
    }],
    isFeatured: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);