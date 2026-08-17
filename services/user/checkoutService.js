const Cart = require('../../models/cartModel');
const User = require('../../models/userModel'); 
const Product = require('../../models/Product'); 
const Coupon = require('../../models/couponModel'); 
const cartService = require('./cartService'); 
const Order = require('../../models/orderModel'); 
const walletService = require('./walletService');

class CheckoutService {

  async getCheckoutData(userId) {
    try {
      const cartData = await cartService.getCartDetails(userId);
      const userData = await User.findById(userId);
      const userAddresses = userData ? userData.addresses : [];

      let totalPriceBeforeDiscount = 0;
      if (cartData.cart && cartData.cart.items) {
        totalPriceBeforeDiscount = cartData.cart.items.reduce((sum, item) => {
          const price = item.price ?? item.variantDoc?.salePrice ?? item.variantDoc?.offerPrice ?? item.variantDoc?.price ?? item.productDoc?.salePrice ?? item.productDoc?.offerPrice ?? item.productDoc?.price ?? 0;
          return sum + (item.quantity * price);
        }, 0);
      }

      const addressSelected = Array.isArray(userAddresses) 
        ? userAddresses.some(addr => addr.isSelected === true) 
        : false;

      const userWallet = await walletService.getWalletByUserId(userId);

      const userOrderCount = await Order.countDocuments({
        user: userId,
        status: { $ne: 'Cancelled' }
      });

      const couponQuery = {
        isActive: true,
        expiryDate: { $gt: new Date() }
      };

      if (userOrderCount > 0) {
        couponQuery.isNewUserOnly = false;
      }

      const activeCoupons = await Coupon.find(couponQuery).lean();

      return {
        cart: cartData.cart ? [cartData.cart] : [], 
        addressList: userAddresses, 
        coupons: activeCoupons || [], 
        wallet: { balance: userWallet ? userWallet.balance : 0 }, 
        totalPriceBeforeDiscount,
        addressSelected
      };
    } catch (error) {
      throw new Error("Checkout service data compilation failure: " + error.message);
    }
  }

  async validateAndApplyCoupon(couponCode, subtotal, userId) {
    const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });

    if (!coupon) {
      return { success: false, message: "Invalid or expired coupon code." };
    }

    if (new Date() > new Date(coupon.expiryDate)) {
      return { success: false, message: "This coupon has expired." };
    }

    if (subtotal < coupon.minOrderAmount) {
      return { 
        success: false, 
        message: `Minimum order amount to apply this coupon is ₹${coupon.minOrderAmount}` 
      };
    }

    const existingOrderWithCoupon = await Order.findOne({
      user: userId,
      couponApplied: coupon._id,
      status: { $ne: 'Cancelled' }
    });

    if (existingOrderWithCoupon) {
      return { success: false, message: "You have already used this coupon on a previous order." };
    }

    if (coupon.isNewUserOnly) {
      const userOrderCount = await Order.countDocuments({
        user: userId,
        status: { $ne: 'Cancelled' }
      });

      if (userOrderCount > 0) {
        return { success: false, message: "This coupon is only valid for first-time orders." };
      }
    }

    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = (subtotal * coupon.discountValue) / 100;
      if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    discountAmount = Math.round(discountAmount);
    const updatedTotal = Math.max(0, subtotal - discountAmount);

    return {
      success: true,
      couponId: coupon._id,
      code: coupon.code,
      discountAmount,
      updatedTotal
    };
  }

  async createOrder(orderData) {
    try {
      const cartDetails = await cartService.getCartDetails(orderData.userId);
      const cartData = cartDetails.cart;

      if (!cartDetails.checkoutReady || !cartData || !cartData.items || cartData.items.length === 0) {
        return { success: false, message: "Your cart contains items that are out of stock or unavailable." };
      }

      const calculatedSubtotal = cartData.items.reduce((sum, item) => {
        const price = item.price ?? item.variantDoc?.salePrice ?? item.variantDoc?.offerPrice ?? item.variantDoc?.price ?? item.productDoc?.salePrice ?? item.productDoc?.offerPrice ?? item.productDoc?.price ?? 0;
        return sum + (item.quantity * price);
      }, 0);

      let validatedDiscountAmount = 0;
      let appliedCouponId = null;

      if (orderData.couponId) {
        const coupon = await Coupon.findById(orderData.couponId);

        if (!coupon || !coupon.isActive || new Date(coupon.expiryDate) < new Date()) {
          return { success: false, message: "The selected coupon is invalid or has expired." };
        }

        if (calculatedSubtotal < coupon.minOrderAmount) {
          return { success: false, message: `Minimum order amount for coupon '${coupon.code}' is ₹${coupon.minOrderAmount}.` };
        }

        const previousOrdersCount = await Order.countDocuments({
          user: orderData.userId,
          status: { $ne: 'Cancelled' }
        });

        if (coupon.isNewUserOnly && previousOrdersCount > 0) {
          return { success: false, message: `Coupon '${coupon.code}' is applicable only on your first purchase.` };
        }

        const existingCouponUsage = await Order.findOne({
          user: orderData.userId,
          couponApplied: coupon._id,
          status: { $ne: 'Cancelled' }
        });

        if (existingCouponUsage) {
          return { success: false, message: `You have already redeemed coupon '${coupon.code}'.` };
        }

        if (coupon.discountType === 'percentage') {
          validatedDiscountAmount = (calculatedSubtotal * coupon.discountValue) / 100;
          if (coupon.maxDiscountAmount && validatedDiscountAmount > coupon.maxDiscountAmount) {
            validatedDiscountAmount = coupon.maxDiscountAmount;
          }
        } else {
          validatedDiscountAmount = coupon.discountValue;
        }

        validatedDiscountAmount = Math.round(validatedDiscountAmount);
        appliedCouponId = coupon._id;
      }

      const finalCalculatedPayable = Math.max(0, calculatedSubtotal - validatedDiscountAmount);

      if (orderData.paymentMethod === 'Wallet') {
        try {
          await walletService.debitWallet({
            userId: orderData.userId,
            amount: finalCalculatedPayable,
            purpose: 'Purchase Payment',
            description: 'Payment for order checkout'
          });
        } catch (walletError) {
          return { 
            success: false, 
            message: walletError.message || "Insufficient wallet balance to place this order." 
          };
        }
      }

      const userData = await User.findById(orderData.userId);
      const selectedAddressObj = userData?.addresses?.find(addr => String(addr._id) === String(orderData.addressId)) || 
                                 userData?.addresses?.find(addr => addr.isSelected) || {};

      const dbItemsArray = [];
      const snapshotItems = [];

      for (const item of cartData.items) {
        const parentProductId = item.productDoc?._id || item.productId?._id;
        const targetVariantId = item.variantDoc?._id;
        const deductQty = Number(item.quantity || 1);
        const priceValue = item.price ?? item.variantDoc?.salePrice ?? item.variantDoc?.offerPrice ?? item.variantDoc?.price ?? item.productDoc?.salePrice ?? item.productDoc?.offerPrice ?? item.productDoc?.price ?? 0;

        let imagePath = "/images/iphone15pro.png"; 
        if (item.productDoc?.images && item.productDoc.images.length > 0) {
          imagePath = item.productDoc.images[0];
        }

        if (parentProductId && targetVariantId) {
          const updatedProduct = await Product.findOneAndUpdate(
            { 
              _id: parentProductId, 
              "variants._id": targetVariantId,
              "variants.quantity": { $gte: deductQty }
            },
            { 
              $inc: { 
                "variants.$.quantity": -deductQty,
                "stock": -deductQty 
              } 
            },
            { new: true }
          );

          if (!updatedProduct) {
            return { success: false, message: `Insufficient stock for product ${item.productDoc?.name || ''}.` };
          }
        }

        const selectedColor = item.variantDoc?.attributes?.color || item.variantDoc?.color || "Standard Config";

        dbItemsArray.push({
          product: parentProductId,
          name: item.productDoc?.name || "Premium Apple Device",
          variantId: targetVariantId?.toString(),
          variantColor: selectedColor,
          quantity: deductQty,
          price: Number(priceValue),
          status: 'Pending'
        });

        snapshotItems.push({
          variantId: targetVariantId,
          name: item.productDoc?.name || "Premium Apple Device",
          variant: selectedColor,
          quantity: deductQty,
          price: Number(priceValue),
          image: imagePath
        });
      }

      let determinedPaymentStatus = orderData.paymentStatus;
      if (!determinedPaymentStatus) {
        if (orderData.paymentMethod === 'Wallet' || orderData.paymentMethod === 'Razorpay') {
          determinedPaymentStatus = 'Paid';
        } else {
          determinedPaymentStatus = 'Pending';
        }
      }

      const newDbOrder = new Order({
        user: orderData.userId,
        items: dbItemsArray,
        shippingAddress: {
          name: selectedAddressObj.fullname || "Valued Customer",
          phone: selectedAddressObj.phone || "N/A",
          addressLine: selectedAddressObj.address || "No address detailed",
          city: selectedAddressObj.city || "Bengaluru",
          state: selectedAddressObj.state || "Karnataka",
          pincode: selectedAddressObj.pincode || "560001"
        },
        paymentMethod: orderData.paymentMethod || 'COD',
        paymentStatus: determinedPaymentStatus,
        subtotal: calculatedSubtotal,
        discountAmount: validatedDiscountAmount,
        totalAmount: finalCalculatedPayable,
        couponApplied: appliedCouponId,
        razorpayOrderId: orderData.razorpayOrderId || null,
        razorpayPaymentId: orderData.razorpayPaymentId || null
      });

      const savedOrder = await newDbOrder.save();

      await Cart.findOneAndUpdate(
        { user: orderData.userId },
        { $set: { items: [] } }
      );

      return { 
        success: true, 
        orderId: savedOrder.orderId, 
        snapshotItems,
        snapshotAddress: {
          fullname: selectedAddressObj.fullname || "Valued Customer",
          address: selectedAddressObj.address || "No address detailed",
          pincode: selectedAddressObj.pincode || "000000",
          phone: selectedAddressObj.phone || "N/A"
        }
      };
    } catch (error) {
      console.error("Database order processing exception:", error.message);
      return { success: false, message: error.message };
    }
  }

  async cancelOrderItem(orderId, variantId, reason) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        return { success: false, message: "Order not found." };
      }

      const itemIndex = order.items.findIndex(item => String(item.variantId) === String(variantId));
      if (itemIndex === -1) {
        return { success: false, message: "Item not found in order." };
      }

      const targetItem = order.items[itemIndex];
      const currentStatus = targetItem.status.toLowerCase();

      if (currentStatus === 'cancelled') {
        return { success: false, message: "Item has already been cancelled." };
      }

      if (['shipped', 'out for delivery', 'delivered', 'returned', 'return request pending'].includes(currentStatus)) {
        return { success: false, message: "This item has moved past warehouse distribution and cannot be cancelled." };
      }

      targetItem.status = 'Cancelled';
      targetItem.cancellationReason = reason || "User requested cancellation.";

      await Product.findOneAndUpdate(
        { _id: targetItem.product, "variants._id": targetItem.variantId },
        { 
          $inc: { 
            "variants.$.quantity": targetItem.quantity,
            "stock": targetItem.quantity 
          } 
        }
      );

      let refundForThisItem = targetItem.price * targetItem.quantity;
      if (order.subtotal > 0 && order.discountAmount > 0) {
        const itemProportion = refundForThisItem / order.subtotal;
        refundForThisItem = Math.round(refundForThisItem - (order.discountAmount * itemProportion));
      }

      order.totalAmount = Math.max(0, order.totalAmount - refundForThisItem);

      const hasActiveItems = order.items.some(i => i.status.toLowerCase() !== 'cancelled');
      if (!hasActiveItems) {
        order.status = 'Cancelled';
      }

      const isPrepaid = order.paymentStatus === 'Paid' || ['Wallet', 'Razorpay', 'Online'].includes(order.paymentMethod);

      if (isPrepaid && refundForThisItem > 0) {
        await walletService.creditWallet({
          userId: order.user,
          amount: refundForThisItem,
          purpose: 'Order Cancellation',
          orderId: order._id,
          description: `Refund for cancelled item (${targetItem.name}) in Order #${order.orderId || order._id}`
        });

        if (!hasActiveItems) {
          order.paymentStatus = 'Refunded';
        }
      }

      await order.save();

      return {
        success: true,
        message: isPrepaid 
          ? "Item cancelled and refund credited to your wallet!" 
          : "Cancellation executed instantly."
      };
    } catch (error) {
      console.error("Cancel order item error:", error);
      return { success: false, message: error.message };
    }
  }

  async cancelAllOrderItems(orderId, userId) {
    try {
      const order = await Order.findOne({ _id: orderId, user: userId });
      if (!order) {
        return { success: false, message: "Order records not found." };
      }

      const lowercaseStatus = order.status ? order.status.toLowerCase() : '';
      if (['cancelled', 'shipped', 'out for delivery', 'delivered', 'returned'].includes(lowercaseStatus)) {
        return { success: false, message: "Order state cannot process a cancellation request at this stage." };
      }

      for (const item of order.items) {
        if (item.status.toLowerCase() !== 'cancelled') {
          await Product.findOneAndUpdate(
            { _id: item.product, "variants._id": item.variantId },
            { 
              $inc: { 
                "variants.$.quantity": item.quantity,
                "stock": item.quantity 
              } 
            }
          );

          item.status = 'Cancelled';
          item.cancellationReason = "Bulk cancellation requested by customer.";
        }
      }

      const totalRefundAmount = order.totalAmount;

      order.status = 'Cancelled';
      order.totalAmount = 0;

      const isPrepaid = order.paymentStatus === 'Paid' || ['Wallet', 'Razorpay', 'Online'].includes(order.paymentMethod);

      if (isPrepaid && totalRefundAmount > 0) {
        await walletService.creditWallet({
          userId: order.user,
          amount: totalRefundAmount,
          purpose: 'Order Cancellation',
          orderId: order._id,
          description: `Full refund for cancelled Order #${order.orderId || order._id}`
        });

        order.paymentStatus = 'Refunded';
      }

      await order.save();

      return {
        success: true,
        message: isPrepaid 
          ? "Entire order cancelled and funds refunded to your wallet." 
          : "Entire order structure successfully cancelled."
      };
    } catch (error) {
      console.error("Bulk cancellation service exception:", error);
      return { success: false, message: error.message };
    }
  }

  async approveReturn(orderId) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        return { success: false, message: "Order not found." };
      }

      if (order.status !== 'Return Requested' && order.status !== 'Return Request Pending') {
        return { success: false, message: "No pending return request for this order." };
      }

      for (const item of order.items) {
        if (item.status.toLowerCase() !== 'returned' && item.status.toLowerCase() !== 'cancelled') {
          await Product.findOneAndUpdate(
            { _id: item.product, "variants._id": item.variantId },
            { 
              $inc: { 
                "variants.$.quantity": item.quantity,
                "stock": item.quantity 
              } 
            }
          );
          item.status = 'Returned';
        }
      }

      await walletService.creditWallet({
        userId: order.user,
        amount: order.totalAmount,
        purpose: 'Order Return',
        orderId: order._id,
        description: `Refund for returned order #${order.orderId || order._id}`
      });

      order.status = 'Returned';
      order.paymentStatus = 'Refunded';
      await order.save();

      return { success: true, message: "Return approved and amount refunded to user wallet." };
    } catch (error) {
      console.error("Approve return error:", error);
      return { success: false, message: error.message };
    }
  }
}

module.exports = new CheckoutService();