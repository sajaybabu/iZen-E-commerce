const Wishlist = require('../../models/wishlistModel');
const Product = require('../../models/Product');
const Category = require('../../models/categoryModel');
const cartService = require('../../services/user/cartService'); 
const mongoose = require('mongoose');

const getWishlistPage = async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.session?.user?._id;
    if (!userId) return res.redirect('/login');

    const objUserId = new mongoose.Types.ObjectId(String(userId));
    
    const hiddenCategories = await Category.find({ 
      $or: [{ isListed: false }, { isDeleted: true }] 
    }).lean();

    const hiddenCategoryNames = hiddenCategories.map(cat => cat.name.trim().toLowerCase());
    const hiddenCategoryIds = hiddenCategories.map(cat => cat._id.toString());

    let wishlist = await Wishlist.findOne({ userId: objUserId }).populate({
      path: 'items.productId',
      model: 'Product'
    }).lean();

    if (!wishlist) {
      wishlist = { items: [] };
    }

    wishlist.items = wishlist.items.filter(item => {
      if (!item.productId) {
        return false; 
      }

      if (item.productId.isBlocked === true || item.productId.isDeleted === true) {
        return false; 
      }

      const productCategoryStr = String(item.productId.category || '').trim().toLowerCase();
      
      const isCategoryHidden = 
        hiddenCategoryNames.includes(productCategoryStr) || 
        hiddenCategoryIds.includes(String(item.productId.category));

      if (isCategoryHidden) {
        return false; 
      }

      return true;
    });

    return res.render('user/wishlist', {
      user: req.session.user,
      wishlist
    });
  } catch (error) {
    console.error("Wishlist rendering trace error:", error);
    return res.redirect('/');
  }
};

const addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in to save items." });
    }

    const objUserId = new mongoose.Types.ObjectId(String(userId));
    const objProdId = new mongoose.Types.ObjectId(String(productId));

    const targetProd = await Product.findById(objProdId).lean();
    if (!targetProd || targetProd.isBlocked || targetProd.isDeleted) {
      return res.status(400).json({ success: false, message: "This item cannot be tracked." });
    }

    const parentCategory = await Category.findOne({ name: targetProd.category }).lean();
    if (parentCategory && (parentCategory.isListed === false || parentCategory.isDeleted === true)) {
      return res.status(400).json({ success: false, message: "This product's category is hidden." });
    }

    let wishlist = await Wishlist.findOne({ userId: objUserId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId: objUserId, items: [] });
    }

    const itemExists = wishlist.items.some(item => String(item.productId) === String(productId));
    if (itemExists) {
      return res.status(400).json({ success: false, message: "Item is already in your wishlist." });
    }

    wishlist.items.push({ productId: objProdId });
    await wishlist.save();

    return res.status(200).json({ success: true, message: "Added to wishlist successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error updating wishlist." });
  }
};

const removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session?.user?.id || req.session?.user?._id;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized context." });
    const objUserId = new mongoose.Types.ObjectId(String(userId));

    await Wishlist.updateOne(
      { userId: objUserId },
      { $pull: { items: { productId: new mongoose.Types.ObjectId(String(productId)) } } }
    );

    return res.status(200).json({ success: true, message: "Item removed from wishlist." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Failed to remove entry." });
  }
};

const moveAllToCart = async (req, res) => {
  try {
    const { variantIds } = req.body;
    const userId = req.session?.user?.id || req.session?.user?._id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in to continue." });
    }

    if (!variantIds || !Array.isArray(variantIds) || variantIds.length === 0) {
      return res.status(400).json({ success: false, message: "No valid variants found to migrate." });
    }

    let itemsAddedCount = 0;
    let errorsEncountered = false;

    for (const variantId of variantIds) {
      try {
        await cartService.addItemToCart(userId, variantId);
        itemsAddedCount++;
      } catch (serviceError) {
        console.warn(`[Bulk Allocation Switch Skip] Variant ${variantId} mapping skipped:`, serviceError.message);
        errorsEncountered = true;
      }
    }

    if (itemsAddedCount === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "All items in your wishlist are currently out of stock or unavailable." 
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully moved ${itemsAddedCount} item(s) to your cart.`,
      partiallyFailed: errorsEncountered
    });

  } catch (error) {
    console.error("Bulk migration failure trace:", error);
    return res.status(500).json({ success: false, message: "Internal server error running bulk migration." });
  }
};

module.exports = {
  getWishlistPage,
  addToWishlist,
  removeFromWishlist,
  moveAllToCart
};