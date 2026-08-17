const Wallet = require('../../models/walletModel');
const User = require('../../models/userModel');

/**
 * Helper to generate a unique referral code format (e.g., IZEN-A1B2C)
 */
const generateReferralCode = () => {
    const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `IZEN-${randomStr}`;
};

/**
 * Add funds to user wallet
 */
const creditWallet = async ({ userId, amount, purpose, orderId = null, description = '' }) => {
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
        wallet = new Wallet({ userId, balance: 0, transactions: [] });
    }

    wallet.balance += Number(amount);
    wallet.transactions.push({
        amount: Number(amount),
        type: 'credit',
        purpose,
        orderId,
        description: description || `₹${amount} credited to wallet.`
    });

    await wallet.save();
    return wallet;
};

/**
 * Deduct funds from user wallet
 */
const debitWallet = async ({ userId, amount, purpose, orderId = null, description = '' }) => {
    const wallet = await Wallet.findOne({ userId });

    if (!wallet || wallet.balance < amount) {
        throw new Error('Insufficient wallet balance.');
    }

    wallet.balance -= Number(amount);
    wallet.transactions.push({
        amount: Number(amount),
        type: 'debit',
        purpose,
        orderId,
        description: description || `₹${amount} debited from wallet.`
    });

    await wallet.save();
    return wallet;
};

/**
 * Get or initialize user wallet with referral code context
 */
const getWalletByUserId = async (userId) => {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
        wallet = await Wallet.create({ userId, balance: 0, transactions: [] });
    }

    // Sort transactions newest first
    if (wallet.transactions && wallet.transactions.length > 0) {
        wallet.transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // Fetch user details to expose referralCode to front-end view
    let user = await User.findById(userId).select('referralCode');

    // If user exists but does not have a referralCode in DB, auto-generate and save one
    if (user && !user.referralCode) {
        user.referralCode = generateReferralCode();
        await user.save();
    }

    return {
        ...wallet.toObject(),
        referralCode: user ? user.referralCode : null
    };
};

module.exports = {
    creditWallet,
    debitWallet,
    getWalletByUserId
};