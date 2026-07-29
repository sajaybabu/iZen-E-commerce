const Cart = require('../../models/cartModel');
const User = require('../../models/userModel'); 
const Variant = require('../../models/variantModel'); 
const Product = require('../../models/Product'); 
const cartService = require('./cartService'); 
const Order = require('../../models/orderModel'); 

class CheckoutService {
    async getCheckoutData(userId) {
        try {
            const cartData = await cartService.getCartDetails(userId);
            const userData = await User.findById(userId);
            const userAddresses = userData ? userData.addresses : [];

            let totalPriceBeforeDiscount = 0;
            if (cartData.cart && cartData.cart.items) {
                totalPriceBeforeDiscount = cartData.cart.items.reduce((sum, item) => {
                    const price = item.variantDoc?.price || item.productDoc?.price || 0;
                    return sum + (item.quantity * price);
                }, 0);
            }

            let addressSelected = false;
            if (userAddresses && Array.isArray(userAddresses)) {
                addressSelected = userAddresses.some(addr => addr.isSelected === true);
            }

            return {
                cart: cartData.cart ? [cartData.cart] : [], 
                addressList: userAddresses, 
                coupons: [], 
                wallet: { balance: 0 }, 
                totalPriceBeforeDiscount,
                addressSelected
            };
        } catch (error) {
            throw new Error("Checkout service data compilation failure: " + error.message);
        }
    }

    async createOrder(orderData) {
        try {
            // Fetch mapped items from the active cart
            const cartDetails = await cartService.getCartDetails(orderData.userId);
            const cartData = cartDetails.cart;

            if (!cartData || !cartData.items || cartData.items.length === 0) {
                return { success: false, message: "Your active shopping checkout cart contains no items." };
            }

            // Resolve destination address
            const userData = await User.findById(orderData.userId);
            const selectedAddressObj = userData.addresses.find(addr => addr._id.toString() === orderData.addressId.toString()) || 
                                       userData.addresses.find(addr => addr.isSelected) || {};

            const dbItemsArray = [];
            const snapshotItems = [];

            // Process inventory deductions and map database items cleanly
            for (const item of cartData.items) {
                const parentProductId = item.productDoc?._id || item.productId?._id;
                const targetVariantId = item.variantDoc?._id;
                const deductQty = Number(item.quantity || 1);
                const priceValue = item.variantDoc?.price || item.productDoc?.price || 0;
                
                let imagePath = "/images/iphone15pro.png"; 
                if (item.productDoc?.images && item.productDoc.images.length > 0) {
                    imagePath = item.productDoc.images[0];
                }

                if (parentProductId && targetVariantId) {
                    // Update both nested variant array stock and global product summary stock
                    await Product.findOneAndUpdate(
                        { _id: parentProductId, "variants._id": targetVariantId },
                        { 
                            $inc: { 
                                "variants.$.quantity": -deductQty,
                                "stock": -deductQty 
                            } 
                        }
                    );
                }

                // Extract variant color from nested attributes
                const selectedColor = item.variantDoc && item.variantDoc.attributes && item.variantDoc.attributes.color 
                    ? item.variantDoc.attributes.color 
                    : (item.variantDoc?.color || "Standard Config");

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

            // Build and save the permanent Order Document inside MongoDB
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
                paymentStatus: orderData.paymentMethod === 'COD' ? 'Pending' : 'Paid',
                subtotal: Number(orderData.totalPriceBeforeDiscount || 0),
                discountAmount: Number(orderData.discountAmount || 0),
                totalAmount: Number(orderData.payablePrice || 0)
            });

            const savedOrder = await newDbOrder.save();

            // Wipe out the user's shopping cart 
            await Cart.findOneAndUpdate(
                { _id: cartData._id },
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
            console.error(" Database order processing exception:", error.message);
            return { success: false, message: error.message };
        }
    }
}

module.exports = new CheckoutService();