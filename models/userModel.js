const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    addressType: { type: String, default: 'Home' },
    address: { type: String, required: true },
    city: { type: String, required: true },
    pincode: { type: String, required: true },
    phone: { type: String, required: true },
    isSelected: { type: Boolean, default: false } 
});

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
    isAdmin: { 
        type: Boolean,
        default: false
    },
    isVerified: { 
        type: Boolean,
        default: false
    },
    isBlocked: { 
        type: Boolean, 
        default: false 
    },
    profileImage: {
        type: String,
        default: "" 
    },
    // field for Address Management
    addresses: [addressSchema] 
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);