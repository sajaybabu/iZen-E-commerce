const Wishlist = require('../../models/wishlistModel');
const Product = require('../../models/Product');
const cartService = require('../../services/user/cartService'); // Integrated to map configurations safely
const mongoose = require('mongoose');

const getWishlistPage = async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.session?.user?._id;
    if (!userId) return res.redirect('/login');

    const objUserId = new mongoose.Types.ObjectId(String(userId));
    
    // Find wishlist and populate
    let wishlist = await Wishlist.findOne({ userId: objUserId }).populate({
      path: 'items.productId',
      model: 'Product'
    }).lean();

    if (!wishlist) {
      wishlist = { items: [] };
    }

    wishlist.items = wishlist.items.map(item => {
      // If Mongoose could not find a matching product by this ID string, preserve the ID so it can be deleted!
      if (!item.productId) {
        return {
          ...item,
          productId: {
            _id: item._id || 'broken_reference', // Try to use the subdocument item id or a placeholder
            name: 'Premium Hardware Configuration (Orphaned Reference)',
            images: ['/uploads/default-apple.png'],
            variants: [{ price: 0, quantity: 0, attributes: { ram: 'N/A', storage: 'N/A', color: 'Default' } }]
          },
          isOrphaned: true,
          actualDatabaseId: item.productId // Keep it hidden for deletion routes
        };
      }
      return item;
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

    let wishlist = await Wishlist.findOne({ userId: objUserId });
    if (!wishlist) {
      wishlist = new Wishlist({ userId: objUserId, items: [] });
    }

    // Prevent duplicate entries inside the items array
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
    if (!productId || productId === 'Unknown' || productId === 'broken_reference') {
      return res.status(400).json({ success: false, message: "Cannot remove item using an unallocated reference string id. Please wipe this item entry directly from your Compass collection database tracking model." });
    }

    const objUserId = new mongoose.Types.ObjectId(String(userId));

    // Pull the item out matching the productId value string
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