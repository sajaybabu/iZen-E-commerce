const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    phone: { type: String },
    isAdmin: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false } 
}, { timestamps: true });

// This line checks if the model exists; if not, it creates it.
module.exports = mongoose.models.User || mongoose.model('User', userSchema);