const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true 
    },
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },
    phone: { 
        type: String, 
        required: false, // Changed from true to support Google Auth
        unique: false    // Changed because multiple nulls would conflict if true
    },
    password: { 
        type: String, 
        required: false // Changed from true because Google users don't have a local password
    },
    googleId: {         // Recommended: Add this to track Google users specifically
        type: String,
        unique: true,
        sparse: true    // This allows regular users to have a "null" googleId without error
    },
    isBlocked: { 
        type: Boolean, 
        default: false 
    },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);