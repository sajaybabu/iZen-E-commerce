const Cart = require('../../models/cartModel');
const Product = require('../../models/Product'); 
const Wishlist = require('../../models/wishlistModel');
const Category = require('../../models/categoryModel');
const mongoose = require('mongoose');

class CartService {
  
  async addItemToCart(userId, variantId) {
    if (!variantId) throw new Error("VARIANT_ID_REQUIRED");

    const objUserId = new mongoose.Types.ObjectId(String(userId));
    const objVariantId = new mongoose.Types.ObjectId(String(variantId));

    const product = await Product.findOne({ "variants._id": objVariantId });
    if (!product) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const variant = product.variants.id(objVariantId);
    if (!variant) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const categoryDoc = await Category.findOne({ name: product.category });
    if (categoryDoc && categoryDoc.isListed === false) {
      throw new Error("PRODUCT_UNAVAILABLE");
    }

    if (product.isBlocked || product.isDeleted) {
      throw new Error("PRODUCT_UNAVAILABLE");
    }

    if (variant.quantity <= 0) {
      throw new Error("OUT_OF_STOCK");
    }

    let cart = await Cart.findOne({ $or: [{ userId: String(userId) }, { userId: objUserId }] });
    if (!cart) {
      cart = new Cart({ userId: objUserId, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => {
      return String(item.variantId || item.variant || '') === String(variantId);
    });

    if (itemIndex > -1) {
      const currentQty = cart.items[itemIndex].quantity;

      if (currentQty >= 5) {
        throw new Error("MAX_LIMIT_REACHED");
      }

      if (currentQty + 1 > variant.quantity) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      cart.items[itemIndex].quantity += 1;
    } else {
      //Store productId explicitly when adding an item
      cart.items.push({ 
        productId: product._id,
        variantId: objVariantId, 
        quantity: 1 
      });
    }

    await cart.save();

    if (Wishlist) {
      await Wishlist.updateOne(
        { $or: [{ userId: String(userId) }, { userId: objUserId }] },
        { $pull: { items: { productId: product._id } } }
      ).catch(() => {});
    }

    return cart;
  }

  async changeQuantity(userId, variantId, action) {
    const objUserId = new mongoose.Types.ObjectId(String(userId));
    const cart = await Cart.findOne({ $or: [{ userId: String(userId) }, { userId: objUserId }] });
    const product = await Product.findOne({ "variants._id": new mongoose.Types.ObjectId(String(variantId)) });

    if (!cart || !product) throw new Error("RESOURCE_NOT_FOUND");

    const variant = product.variants.id(variantId);
    const itemIndex = cart.items.findIndex(item => String(item.variantId || item.variant || '') === String(variantId));
    if (itemIndex === -1) throw new Error("ITEM_NOT_IN_CART");

    let currentQty = cart.items[itemIndex].quantity;

    if (action === 'increment') {
      if (currentQty >= 5) throw new Error("MAX_LIMIT_REACHED");
      if (currentQty + 1 > variant.quantity) throw new Error("INSUFFICIENT_STOCK");
      cart.items[itemIndex].quantity += 1;
    } else if (action === 'decrement') {
      if (currentQty > 1) {
        cart.items[itemIndex].quantity -= 1;
      } else {
        cart.items.splice(itemIndex, 1);
      }
    }

    return await cart.save();
  }

  async removeItemFromCart(userId, variantId) {
    const objUserId = new mongoose.Types.ObjectId(String(userId));
    const cart = await Cart.findOneAndUpdate(
      { $or: [{ userId: String(userId) }, { userId: objUserId }] },
      { $pull: { items: { variantId: new mongoose.Types.ObjectId(String(variantId)) } } },
      { returnDocument: 'after' }
    );

    if (!cart) throw new Error("CART_NOT_FOUND");
    return cart;
  }

 async getCartDetails(userId) {
    const objUserId = new mongoose.Types.ObjectId(String(userId));
    let cart = await Cart.findOne({ $or: [{ userId: String(userId) }, { userId: objUserId }] });
    
    if (cart && cart.items && cart.items.length > 0) {
      const itemsBuffer = [];
      let cartUpdated = false;
      
      for (let i = 0; i < cart.items.length; i++) {
        let item = cart.items[i];
        
        const targetProdId = item.productId;
        let targetVariantId = item.variantId;
        
        let targetProduct = null;

        //  Find the master product directly by its ID
        if (targetProdId && mongoose.Types.ObjectId.isValid(String(targetProdId))) {
          targetProduct = await Product.findById(new mongoose.Types.ObjectId(String(targetProdId))).lean();
        }
        
        // fallback lookups
        if (!targetProduct && targetVariantId && mongoose.Types.ObjectId.isValid(String(targetVariantId))) {
          targetProduct = await Product.findOne({ "variants._id": new mongoose.Types.ObjectId(String(targetVariantId)) }).lean();
        }
        
        if (targetProduct) {
          const itemObj = item.toObject ? item.toObject() : item;
          
          // Try to find the exact variant matching saved ID
          let specificVariant = null;
          if (targetProduct.variants && targetProduct.variants.length > 0) {
            specificVariant = targetProduct.variants.find(v => String(v._id) === String(targetVariantId));
            
            // If the exact variant ID is missing (because admin deleted/recreated it),
            // but the product has active variants, automatically pair it with the first available one 
            // and update the cart item so it seamlessly recovers when restocked
            if (!specificVariant && targetProduct.variants.length > 0) {
              specificVariant = targetProduct.variants[0]; // Fallback to the live version
              item.variantId = specificVariant._id; // Update the ID on the Mongoose document object
              itemObj.variantId = specificVariant._id;
              cartUpdated = true; // Mark that we healed an item ID
            }
          }

          const categoryDoc = await Category.findOne({ name: targetProduct.category }).lean();

          itemObj.productId = targetProduct;
          itemObj.product = targetProduct;
          itemObj.productDoc = targetProduct; 
          
          itemObj.variantDoc = specificVariant || { 
            quantity: 0, 
            price: targetProduct.price || 0,
            images: targetProduct.images || [],
            attributes: { Color: "Default", RAM: "Standard" }
          };
          
          itemObj.categoryDoc = categoryDoc || null;
          itemsBuffer.push(itemObj);
        } else {
          const itemObj = item.toObject ? item.toObject() : item;
          itemObj.productDoc = null;
          itemObj.variantDoc = null;
          itemObj.categoryDoc = null;
          itemsBuffer.push(itemObj);
        }
      }
      
      // Save back to database if any variant IDs were auto-healed to the new admin-generated ones
      if (cartUpdated) {
        await cart.save().catch(err => console.error("Cart auto-heal save error:", err));
      }
      
      cart = cart.toObject ? cart.toObject() : cart;
      cart.items = itemsBuffer;
    }

    let checkoutReady = true;
    let fallbackItemsFound = false;

    if (cart && cart.items && cart.items.length > 0) {
      cart.items.forEach(item => {
        const prod = item.productDoc;
        const v = item.variantDoc;
        const cat = item.categoryDoc;
        
        if (!prod) {
          checkoutReady = false;
          item.isInvalid = true;
          return;
        }
        
        const isProductHidden = 
          prod.isBlocked === true || 
          prod.isDeleted === true || 
          (cat && cat.isListed === false) || 
          (cat && cat.isDeleted === true);

        const isOutOfStock = !v || v.quantity === undefined || v.quantity <= 0 || item.quantity > v.quantity;

        if (isProductHidden || isOutOfStock) {
          checkoutReady = false;
          fallbackItemsFound = true;
          item.isInvalid = true; 
        }
      });
    }

    return {
      cart: cart || { items: [] },
      checkoutReady: cart && cart.items && cart.items.length > 0 ? checkoutReady : false,
      fallbackItemsFound
    };
  }
}

module.exports = new CartService();