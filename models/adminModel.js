const mongoose = require('mongoose'); 

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    isListed: { type: Boolean, default: true }, // true = Active, false = Blocked
  },
  { timestamps: true },
);


module.exports = mongoose.model('Admin', adminSchema, 'users');