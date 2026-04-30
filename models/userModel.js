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
        required: false, 
        unique: false    
    },
    password: { 
        type: String, 
        required: false 
    },
    googleId: {         
        type: String,
        unique: true,
        sparse: true    
    },
    isAdmin: { // ADD THIS: This allows Mongoose to "see" the admin flag
        type: Boolean,
        default: false
    },
    isVerified: { // ADD THIS: To match your Shell insert
        type: Boolean,
        default: false
    },
    isBlocked: { 
        type: Boolean, 
        default: false 
    },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);