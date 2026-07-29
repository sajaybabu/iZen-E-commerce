const User = require('../../models/adminModel');
const bcrypt = require('bcrypt');

const verifyAdminLogin = async (email, password) => {

    const admin = await User.findOne({
        email,
        isAdmin: true
    });

    if (!admin) {
        return null;
    }

    const isPasswordMatch =
        await bcrypt.compare(password, admin.password);

    if (!isPasswordMatch) {
        return null;
    }

    return admin;
};

module.exports = {
    verifyAdminLogin
};