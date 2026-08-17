const Product = require('../../models/Product');
const Category = require('../../models/categoryModel');
const Referral = require('../../models/referralModel');

exports.loadOffersPage = async (req, res) => {
    try {
        const products = await Product.find({ isDeleted: { $ne: true } }).select('name discount productOffer');
        const categories = await Category.find({ isDeleted: { $ne: true } }).select('name discount');
        let referral = await Referral.findOne();

        if (!referral) {
            referral = await Referral.create({ referrerReward: 0, refereeReward: 0, isActive: true });
        }

        res.render('admin/offerManagement', {
            products,
            categories,
            referral
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading offers page');
    }
};

exports.updateProductOffer = async (req, res) => {
    try {
        const { productId, discount } = req.body;
        const discountVal = Number(discount) || 0;

        if (discountVal < 0 || discountVal > 100) {
            return res.status(400).json({ success: false, message: 'Discount must be between 0 and 100%' });
        }

        await Product.findByIdAndUpdate(productId, { productOffer: discountVal });
        return res.status(200).json({ success: true, message: 'Product offer updated successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error updating product offer.' });
    }
};

exports.updateCategoryOffer = async (req, res) => {
    try {
        const { categoryId, discount } = req.body;
        const discountVal = Number(discount) || 0;

        if (discountVal < 0 || discountVal > 100) {
            return res.status(400).json({ success: false, message: 'Discount must be between 0 and 100%' });
        }

        await Category.findByIdAndUpdate(categoryId, { discount: discountVal });
        return res.status(200).json({ success: true, message: 'Category offer updated successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error updating category offer.' });
    }
};

exports.updateReferralOffer = async (req, res) => {
    try {
        const { referrerReward, refereeReward, isActive } = req.body;

        let referral = await Referral.findOne();
        if (!referral) {
            referral = new Referral();
        }

        referral.referrerReward = Number(referrerReward) || 0;
        referral.refereeReward = Number(refereeReward) || 0;
        referral.isActive = isActive === 'true' || isActive === true;

        await referral.save();
        return res.status(200).json({ success: true, message: 'Referral offer updated successfully.' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Server error updating referral offer.' });
    }
};