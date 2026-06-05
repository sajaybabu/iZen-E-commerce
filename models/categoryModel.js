const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: { 
        type: String,
        required: true
    },
    // FIXED: Added missing discount field definition here to match your frontend logic
    discount: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    isListed: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);