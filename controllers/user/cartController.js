const cartService = require('../../services/user/cartService');
const Product = require('../../models/Product'); 

const addToCart = async (req, res) => {
  try {
    const { variantId } = req.body;
    const userId = req.session?.user?.id; 

    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in to continue." });
    }

    if (!variantId) {
      return res.status(400).json({ success: false, message: "Missing item configuration identifiers." });
    }

    const processingCart = await cartService.addItemToCart(userId, variantId);

    return res.status(200).json({ 
      success: true, 
      message: "Item successfully added to your iZen cart.",
      cart: processingCart 
    });

  } catch (error) {
    console.error("Cart transaction capture error trace:", error.message);
    
    if (error.message === "OUT_OF_STOCK") {
      return res.status(400).json({ success: false, message: "This item is currently out of stock." });
    }
    if (error.message === "MAX_LIMIT_REACHED") {
      return res.status(400).json({ success: false, message: "Maximum quantity limit reached for this item." });
    }
    if (error.message === "PRODUCT_UNAVAILABLE") {
      return res.status(423).json({ success: false, message: "This item is currently unlisted or blocked." });
    }
    if (error.message === "INSUFFICIENT_STOCK") {
      return res.status(400).json({ success: false, message: "Requested allocation exceeds available warehouse levels." });
    }

    return res.status(500).json({ success: false, message: "Internal server error processing cart allocation." });
  }
};

const updateQuantity = async (req, res) => {
  try {
    const { variantId, productId, action, change } = req.body;
    const userId = req.session?.user?.id || req.session?.user?._id || req.session?.user_id;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user session." });
    }

    const targetId = variantId || productId;
    if (!targetId) {
      return res.status(400).json({ success: false, message: "Missing item identifier." });
    }

    let resolvedAction = action;
    if (!resolvedAction && change !== undefined) {
      resolvedAction = Number(change) > 0 ? 'increment' : 'decrement';
    }

    if (!resolvedAction) {
      return res.status(400).json({ success: false, message: "Missing action directive." });
    }

    const updatedCart = await cartService.changeQuantity(userId, targetId, resolvedAction);
    
    return res.status(200).json({ success: true, cart: updatedCart });
  } catch (error) {
    console.error("QUANTITY UPDATE ERROR TRACE:", error);
    
    let userMsg = error.message;
    if (error.message === "MAX_LIMIT_REACHED") userMsg = "Maximum limit reached for this item.";
    if (error.message === "INSUFFICIENT_STOCK") userMsg = "Insufficient stock available.";

    return res.status(400).json({ success: false, message: userMsg || "Could not update item quantity." });
  }
};

const removeProduct = async (req, res) => {
  try {
    const { variantId } = req.params;
    const userId = req.session?.user?.id || req.session?.user?._id || req.session?.user_id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized execution context." });
    }

    const updatedCart = await cartService.removeItemFromCart(userId, variantId);
    return res.status(200).json({ success: true, message: "Product removed.", cart: updatedCart });
  } catch (error) {
    console.error("REMOVE PRODUCT ERROR TRACE:", error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};

const getCartPage = async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.session?.user?._id || req.session?.user_id;
    if (!userId) return res.redirect('/login');

    let cartData = await cartService.getCartDetails(userId);
    let filteredItems = [];

    if (cartData.cart && cartData.cart.items) {
      cartData.cart.items.forEach(item => {
        const rawItem = item.toObject ? item.toObject() : item;
        const productDoc = rawItem.productDoc || rawItem.productId || rawItem.product;
        const activeVariant = rawItem.variantDoc;
        const categoryDoc = rawItem.categoryDoc;

        if (!productDoc) return; 

        const isProductHidden = 
          productDoc.isBlocked === true || 
          productDoc.isDeleted === true || 
          (categoryDoc && categoryDoc.isListed === false) ||
          (categoryDoc && categoryDoc.isDeleted === true);

        if (isProductHidden) {
          return; 
        }

        const isOutOfStock = !activeVariant || 
                             activeVariant.quantity === undefined || 
                             activeVariant.quantity <= 0 || 
                             rawItem.quantity > activeVariant.quantity;

        //  Determine regular base price
        const regularPrice = activeVariant?.price || activeVariant?.salePrice || productDoc.price || 0;

        //  Resolve discount percentages (Product level & Category level)
        const productOfferPercent = productDoc.productOffer || productDoc.discountPercentage || productDoc.offerPercentage || 0;
        const categoryOfferPercent = categoryDoc ? (categoryDoc.categoryOffer || categoryDoc.discountPercentage || 0) : 0;
        
        // Highest percentage discount takes priority
        const maxDiscountPercent = Math.max(productOfferPercent, categoryOfferPercent);

        //  Resolve Effective Offer Price
        let effectivePrice = regularPrice;

        if (activeVariant?.offerPrice && activeVariant.offerPrice < regularPrice) {
          effectivePrice = activeVariant.offerPrice;
        } else if (productDoc.offerPrice && productDoc.offerPrice < regularPrice) {
          effectivePrice = productDoc.offerPrice;
        } else if (maxDiscountPercent > 0) {
          effectivePrice = Math.round(regularPrice - (regularPrice * (maxDiscountPercent / 100)));
        }

        // Check if item has a valid active offer
        const hasOffer = effectivePrice < regularPrice;

        filteredItems.push({
          ...rawItem,
          productDoc: productDoc,
          variantDoc: activeVariant ? {
            ...activeVariant,
            price: regularPrice,
            offerPrice: hasOffer ? effectivePrice : null
          } : { quantity: 0, price: regularPrice, offerPrice: null },
          regularPrice: regularPrice,
          effectivePrice: effectivePrice,
          hasOffer: hasOffer,
          itemSubtotal: effectivePrice * rawItem.quantity,
          isBlockedItem: false,
          isOutOfStockItem: isOutOfStock
        });
      });

      cartData.cart.items = filteredItems;
      cartData.cart.subtotal = filteredItems.reduce((acc, curr) => acc + curr.itemSubtotal, 0);
    }
    
    return res.render('user/cart', {
      user: req.session.user, 
      cart: cartData.cart,
      checkoutReady: filteredItems.length > 0 && !filteredItems.some(i => i.isOutOfStockItem),
      fallbackItemsFound: filteredItems.some(i => i.isOutOfStockItem)
    });
  } catch (error) {
    console.error("EJS Render capture error:", error);
    return res.redirect('/');
  }
};

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session?.user?.id || req.session?.user?._id || req.session?.user_id;
    if (!userId) return res.redirect('/login');

    const cartData = await cartService.getCartDetails(userId);
    let systemCheckoutReady = true;

    if (!cartData.cart || !cartData.cart.items || cartData.cart.items.length === 0) {
      return res.redirect('/cart');
    }

    for (let item of cartData.cart.items) {
      const rawItem = item.toObject ? item.toObject() : item;
      const productDoc = rawItem.productDoc || rawItem.productId;
      const categoryDoc = rawItem.categoryDoc;
      const activeVariant = rawItem.variantDoc;

      if (!productDoc || productDoc.isBlocked === true || productDoc.isDeleted === true || 
          (categoryDoc && categoryDoc.isListed === false) || !activeVariant || 
          activeVariant.quantity <= 0 || rawItem.quantity > activeVariant.quantity) {
        systemCheckoutReady = false;
        break;
      }
    }

    if (!systemCheckoutReady) {
      return res.redirect('/cart'); 
    }
    
    return res.render('user/checkout', { 
      user: req.session.user, 
      cart: cartData.cart 
    });

  } catch (error) {
    console.error("Checkout page security error:", error);
    return res.redirect('/cart');
  }
};

module.exports = {
  addToCart,
  updateQuantity,
  removeProduct, 
  getCartPage,
  getCheckoutPage   
};