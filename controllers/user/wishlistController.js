const Wishlist = require('../../models/wishlistModel');
const Product = require('../../models/Product');
const Category = require('../../models/categoryModel'); // Added Category model import
const cartService = require('../../services/user/cartService'); 
const mongoose = require('mongoose');

const getWishlistPage = async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.session?.user?._id;
    if (!userId) return res.redirect('/login');

    const objUserId = new mongoose.Types.ObjectId(String(userId));
    
    // Fetch all unlisted or deleted categories from the database
    const hiddenCategories = await Category.find({ 
      $or: [{ isListed: false }, { isDeleted: true }] 
    }).lean();

    // Create a lowercase list of hidden category names for robust string matching
    const hiddenCategoryNames = hiddenCategories.map(cat => cat.name.trim().toLowerCase());
    const hiddenCategoryIds = hiddenCategories.map(cat => cat._id.toString());

    // Find wishlist and populate product data
    let wishlist = await Wishlist.findOne({ userId: objUserId }).populate({
      path: 'items.productId',
      model: 'Product'
    }).lean();

    if (!wishlist) {
      wishlist = { items: [] };
    }

    // Filter out missing, blocked, deleted, OR unlisted category items
    wishlist.items = wishlist.items.filter(item => {
      if (!item.productId) {
        return false; // Product no longer exists in DB
      }

      // Check root product block/delete properties
      if (item.productId.isBlocked === true || item.productId.isDeleted === true) {
        return false; 
      }

      // Check if product belongs to a hidden/unlisted category
      const productCategoryStr = String(item.productId.category || '').trim().toLowerCase();
      
      const isCategoryHidden = 
        hiddenCategoryNames.includes(productCategoryStr) || 
        hiddenCategoryIds.includes(String(item.productId.category));

      if (isCategoryHidden) {
        return false; // Skip displaying this item since its category is unlisted
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

    // Verify product status before allowing it into the wishlist layout array
    const targetProd = await Product.findById(objProdId).lean();
    if (!targetProd || targetProd.isBlocked || targetProd.isDeleted) {
      return res.status(400).json({ success: false, message: "This item cannot be tracked." });
    }

    // Double check parent category listing status
    const parentCategory = await Category.findOne({ name: targetProd.category }).lean();
    if (parentCategory && (parentCategory.isListed === false || parentCategory.isDeleted === true)) {
      return res.status(400).json({ success: false, message: "This product's ecosystem is currently hidden." });
    }

    let wishlist = await Wishlist.findOne({ userId: objUserId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId: objUserId, items: [] });
    }

    const itemExists = wishlist.items.some(item => String(item.productId) === String(productId));
    if (itemExists) {
      return res.status(400).json({ success: false, message: "Item is already configured in your wishlist." });
    }

    wishlist.items.push({ productId: objProdId });
    await wishlist.save();

    return res.status(200).json({ success: true, message: "Architecture saved to wishlist successfully." });
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

    return res.status(200).json({ success: true, message: "Item dropped from wishlist layout." });
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
      return res.status(400).json({ success: false, message: "No valid hardware variants found to migrate." });
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
        message: "All items in your wishlist are currently out of stock or unavailable at the warehouse level." 
      });
    }

    return res.status(200).json({
      success: true,
      message: `Successfully allocated ${itemsAddedCount} configuration architecture profile layouts directly into your active cart layout.`,
      partiallyFailed: errorsEncountered
    });

  } catch (error) {
    console.error("Bulk migration root route failure trace:", error);
    return res.status(500).json({ success: false, message: "Internal server anomaly running bulk database translation logic." });
  }
};

module.exports = {
  getWishlistPage,
  addToWishlist,
  removeFromWishlist,
  moveAllToCart
};