// controllers/user/walletController.js
const walletService = require('../../services/user/walletService');

const getWalletPage = async (req, res) => {
    try {
        // Correctly extract the ID property from Passport or Session
        const userId = req.user?._id || req.session?.user?._id || req.session?.user?.id;

        if (!userId) {
            console.log(" No user ID found in session or passport");
            return res.redirect('/login');
        }

        // Pass the clean string/ObjectId to your service
        let wallet = await walletService.getWalletByUserId(userId);

        if (!wallet) {
            wallet = { balance: 0, transactions: [], referralCode: null };
        }

        return res.render('user/wallet', {
            title: 'My Wallet',
            user: req.user || req.session.user,
            wallet
        });

    } catch (error) {
        console.error('CRITICAL WALLET PAGE ERROR:', error);
        return res.redirect('/profile');
    }
};

module.exports = {
    getWalletPage
};