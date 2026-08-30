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
    if (!product) throw new Error("PRODUCT_NOT_FOUND");

    const variant = product.variants.id(objVariantId);
    if (!variant) throw new Error("PRODUCT_NOT_FOUND");

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

    const itemIndex = cart.items.findIndex(item => 
      String(item.variantId || item.variant || '') === String(variantId)
    );

    if (itemIndex > -1) {
      const currentQty = cart.items[itemIndex].quantity;

      if (currentQty >= 5) throw new Error("MAX_LIMIT_REACHED");
      if (currentQty + 1 > variant.quantity) throw new Error("INSUFFICIENT_STOCK");

      cart.items[itemIndex].quantity += 1;
    } else {
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
    
    if (!cart) throw new Error("RESOURCE_NOT_FOUND");
    if (!mongoose.Types.ObjectId.isValid(String(variantId))) throw new Error("INVALID_ID");

    const targetObjId = new mongoose.Types.ObjectId(String(variantId));

    let product = await Product.findOne({ "variants._id": targetObjId });
    let variant = product?.variants?.id(targetObjId);

    if (!product) {
      product = await Product.findById(targetObjId);
      if (product && product.variants && product.variants.length > 0) {
        variant = product.variants[0];
      }
    }

    if (!product) throw new Error("RESOURCE_NOT_FOUND");

    const itemIndex = cart.items.findIndex(item => 
      String(item.variantId || '') === String(variantId) || 
      String(item.productId || '') === String(variantId)
    );

    if (itemIndex === -1) throw new Error("ITEM_NOT_IN_CART");

    const currentQty = cart.items[itemIndex].quantity;
    const maxAvailable = variant ? variant.quantity : (product.quantity || 10);

    if (action === 'increment') {
      if (currentQty >= 5) throw new Error("MAX_LIMIT_REACHED");
      if (currentQty + 1 > maxAvailable) throw new Error("INSUFFICIENT_STOCK");
      cart.items[itemIndex].quantity += 1;
    } else if (action === 'decrement') {
      if (currentQty > 1) {
        cart.items[itemIndex].quantity -= 1;
      } else {
        cart.items.splice(itemIndex, 1);
      }
    }

    await cart.save();
    return cart;
  }

  async removeItemFromCart(userId, variantId) {
    const objUserId = new mongoose.Types.ObjectId(String(userId));
    const targetVariantId = new mongoose.Types.ObjectId(String(variantId));
    
    const cart = await Cart.findOneAndUpdate(
      { $or: [{ userId: String(userId) }, { userId: objUserId }] },
      { $pull: { items: { $or: [{ variantId: targetVariantId }, { productId: targetVariantId }] } } },
      { returnDocument: 'after' }
    );

    if (!cart) throw new Error("CART_NOT_FOUND");
    return cart;
  }

  async getCartDetails(userId) {
    const objUserId = new mongoose.Types.ObjectId(String(userId));
    let cart = await Cart.findOne({ $or: [{ userId: String(userId) }, { userId: objUserId }] });
    
    if (!cart || !cart.items || cart.items.length === 0) {
      return {
        cart: cart || { items: [] },
        checkoutReady: false,
        fallbackItemsFound: false
      };
    }

    const productIds = cart.items
      .map(item => item.productId)
      .filter(id => id && mongoose.Types.ObjectId.isValid(String(id)));

    const variantIds = cart.items
      .map(item => item.variantId)
      .filter(id => id && mongoose.Types.ObjectId.isValid(String(id)));

    const fetchedProducts = await Product.find({
      $or: [
        { _id: { $in: productIds } },
        { "variants._id": { $in: variantIds } }
      ]
    }).lean();

    const categoryNames = [...new Set(fetchedProducts.map(p => p.category))];
    const fetchedCategories = await Category.find({ name: { $in: categoryNames } }).lean();

    const categoryMap = new Map(fetchedCategories.map(c => [c.name, c]));
    const productMap = new Map(fetchedProducts.map(p => [String(p._id), p]));

    const itemsBuffer = [];
    let cartUpdated = false;

    for (let item of cart.items) {
      let targetProduct = productMap.get(String(item.productId));

      if (!targetProduct && item.variantId) {
        targetProduct = fetchedProducts.find(p => 
          p.variants && p.variants.some(v => String(v._id) === String(item.variantId))
        );
      }

      if (targetProduct) {
        const itemObj = item.toObject ? item.toObject() : item;
        let specificVariant = null;

        if (targetProduct.variants && targetProduct.variants.length > 0) {
          specificVariant = targetProduct.variants.find(v => String(v._id) === String(item.variantId));

          if (!specificVariant) {
            specificVariant = targetProduct.variants[0];
            item.variantId = specificVariant._id;
            itemObj.variantId = specificVariant._id;
            cartUpdated = true;
          }
        }

        const categoryDoc = categoryMap.get(targetProduct.category) || null;

        // Calculate offer percentage
        const prodOffer = targetProduct.productOffer || targetProduct.discountPercentage || 0;
        const catOffer = categoryDoc ? (categoryDoc.categoryOffer || categoryDoc.discountPercentage || 0) : 0;
        const effectiveOfferPercent = Math.max(prodOffer, catOffer);

        const basePrice = specificVariant?.price || targetProduct.price || 0;
        let offerPrice = specificVariant?.offerPrice || targetProduct.offerPrice || null;

        if (!offerPrice && effectiveOfferPercent > 0) {
          offerPrice = Math.round(basePrice - (basePrice * (effectiveOfferPercent / 100)));
        }

        itemObj.productId = targetProduct;
        itemObj.product = targetProduct;
        itemObj.productDoc = targetProduct;
        itemObj.variantDoc = specificVariant ? {
          ...specificVariant,
          price: basePrice,
          offerPrice: offerPrice
        } : {
          quantity: 0,
          price: basePrice,
          offerPrice: offerPrice,
          images: targetProduct.images || [],
          attributes: { Color: "Default", RAM: "Standard" }
        };
        itemObj.categoryDoc = categoryDoc;
        itemsBuffer.push(itemObj);
      } else {
        const itemObj = item.toObject ? item.toObject() : item;
        itemObj.productDoc = null;
        itemObj.variantDoc = null;
        itemObj.categoryDoc = null;
        itemsBuffer.push(itemObj);
      }
    }

    if (cartUpdated) {
      await cart.save().catch(err => console.error("Cart auto-heal save error:", err));
    }

    cart = cart.toObject ? cart.toObject() : cart;
    cart.items = itemsBuffer;

    let checkoutReady = true;
    let fallbackItemsFound = false;

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

    return {
      cart,
      checkoutReady,
      fallbackItemsFound
    };
  }

  async clearCart(userId) {
  const objUserId = new mongoose.Types.ObjectId(String(userId));
  
  // Resets the items array back to empty
  const cart = await Cart.findOneAndUpdate(
    { $or: [{ userId: String(userId) }, { userId: objUserId }] },
    { $set: { items: [] } },
    { returnDocument: 'after' }
  );

  return cart;
}
}

module.exports = new CartService();