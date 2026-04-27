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
        required: true, 
        unique: true 
    },
    password: { 
        type: String, 
        required: true 
    },
    isBlocked: { 
        type: Boolean, 
        default: false 
    },
    // We'll add the address array later in the week!
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);