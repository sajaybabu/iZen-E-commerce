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

    // Await database writing logic execution completely
    const processingCart = await cartService.addItemToCart(userId, variantId);

    return res.status(200).json({ 
      success: true, 
      message: "Item successfully mapped to your iZen cart.",
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
    const { variantId, action, change } = req.body;
    const userId = req.session?.user?.id || req.session?.user?._id || req.session?.user_id;
    

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized execution context." });
    }

    if (!variantId) {
      return res.status(400).json({ success: false, message: "Missing matching payload variables." });
    }

    let resolvedAction = action;
    if (!resolvedAction && change !== undefined) {
      resolvedAction = Number(change) > 0 ? 'increment' : 'decrement';
    }

    if (!resolvedAction) {
      console.log("Rejecting: Could not resolve action string");
      return res.status(400).json({ success: false, message: "Missing matching action execution directives." });
    }

    const updatedCart = await cartService.changeQuantity(userId, variantId, resolvedAction);
    return res.status(200).json({ success: true, cart: updatedCart });
  } catch (error) {
    console.error("QUANTITY ERROR TRACE:", error.message);
    return res.status(400).json({ success: false, message: error.message });
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
    const userId = req.session?.user?.id;
    if (!userId) return res.redirect('/login');

    let cartData = await cartService.getCartDetails(userId);

    let filteredItems = [];
    let itemsToPurge = [];
    let hasInvalidOrUnlistedItems = false;

    if (cartData.cart && cartData.cart.items) {
      cartData.cart.items.forEach(item => {
        const rawItem = item.toObject ? item.toObject() : item;
        
        // Fetch properties from the service layer output
        const productDoc = rawItem.productDoc || rawItem.productId || rawItem.product;
        const activeVariant = rawItem.variantDoc;
        const categoryDoc = rawItem.categoryDoc;
        if (!productDoc) {
          if (rawItem.variantId) {
            itemsToPurge.push(String(rawItem.variantId));
          }
          return; // Skip rendering only if the whole product is deleted from DB
        }

        // Check product block status OR parent category unlisted status
        const isProductHidden = 
          productDoc.isBlocked === true || 
          productDoc.isDeleted === true || 
          (categoryDoc && categoryDoc.isListed === false) ||
          (categoryDoc && categoryDoc.isDeleted === true);

        // If activeVariant is missing OR quantity is 0 or less, mark it as Out of Stock
        //  even if the admin panel completely deletes the variant from the product, it stays on screen
        const isOutOfStock = !activeVariant || 
                             activeVariant.quantity === undefined || 
                             activeVariant.quantity <= 0 || 
                             rawItem.quantity > activeVariant.quantity;

        if (isProductHidden || isOutOfStock) {
          hasInvalidOrUnlistedItems = true; 
        }

        filteredItems.push({
          ...rawItem,
          productDoc: productDoc,
          // Fallback variant document context so EJS rendering engine doesn't break
          variantDoc: activeVariant || { quantity: 0, price: productDoc.price || 0 },
          isBlockedItem: isProductHidden,
          isOutOfStockItem: isOutOfStock
        });
      });

      // Background cleanup ONLY if the master product collection row is completely null
      if (itemsToPurge.length > 0) {
        for (let variantId of itemsToPurge) {
          await cartService.removeItemFromCart(userId, variantId);
        }
        cartData = await cartService.getCartDetails(userId);
        
        filteredItems = [];
        hasInvalidOrUnlistedItems = false;
        
        if (cartData.cart && cartData.cart.items) {
          cartData.cart.items.forEach(item => {
            const rawItem = item.toObject ? item.toObject() : item;
            const productDoc = rawItem.productDoc;
            const activeVariant = rawItem.variantDoc;
            const catDoc = rawItem.categoryDoc;
            
            if (productDoc) {
              const isProductHidden = productDoc.isBlocked === true || productDoc.isDeleted === true || (catDoc && catDoc.isListed === false);
              const isOutOfStock = !activeVariant || activeVariant.quantity === undefined || activeVariant.quantity <= 0 || rawItem.quantity > activeVariant.quantity;
              
              if (isProductHidden || isOutOfStock) {
                hasInvalidOrUnlistedItems = true;
              }
              filteredItems.push({ 
                ...rawItem, 
                productDoc, 
                variantDoc: activeVariant || { quantity: 0, price: productDoc.price || 0 },
                isBlockedItem: isProductHidden,
                isOutOfStockItem: isOutOfStock
              });
            }
          });
        }
      }
      
      cartData.cart.items = filteredItems;
    }
    
    return res.render('user/cart', {
      user: req.session.user, 
      cart: cartData.cart,
      checkoutReady: !hasInvalidOrUnlistedItems && filteredItems.length > 0,
      fallbackItemsFound: hasInvalidOrUnlistedItems
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
    let systemCheckoutReady = cartData.checkoutReady;

    if (cartData.cart && cartData.cart.items) {
      for (let item of cartData.cart.items) {
        const rawItem = item.toObject ? item.toObject() : item;
        const productDoc = rawItem.productId || rawItem.product;
        const categoryDoc = rawItem.categoryDoc;
        
        let activeVariant = null;
        if (productDoc && productDoc.variants) {
          const targetId = String(rawItem.variantId || rawItem.variant || '');
          activeVariant = productDoc.variants.find(v => String(v._id) === targetId);
        }

        // Hard security block check
        if (!productDoc || !activeVariant || productDoc.isBlocked === true || productDoc.isDeleted === true || (categoryDoc && categoryDoc.isListed === false) || activeVariant.quantity <= 0 || rawItem.quantity > activeVariant.quantity) {
          systemCheckoutReady = false;
          break;
        }
      }
    }

    if (!systemCheckoutReady || !cartData.cart || !cartData.cart.items || cartData.cart.items.length === 0) {
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