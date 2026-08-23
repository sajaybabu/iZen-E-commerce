const checkoutService = require('../../services/user/checkoutService');
const userService = require('../../services/user/userService'); // Adjust path to your userService if needed
const PDFDocument = require('pdfkit');
const User = require('../../models/userModel');
const Order = require('../../models/orderModel'); 
const crypto = require('crypto');
const Razorpay = require('razorpay');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user?.id || req.session.user?._id || req.session.user_id; 
        if (!userId) return res.redirect('/login');

        const checkoutData = await checkoutService.getCheckoutData(userId) || {};
        const appliedCoupon = req.session.appliedCoupon || null;

        // Ensure cart items carry the offer price evaluated from cartService
        const cartList = (checkoutData.cart || []).map(cart => {
            if (cart.items) {
                cart.items = cart.items.map(item => ({
                    ...item,
                    price: item.price ?? item.variantDoc?.salePrice ?? item.variantDoc?.offerPrice ?? item.variantDoc?.price ?? item.productDoc?.salePrice ?? item.productDoc?.offerPrice ?? item.productDoc?.price ?? 0
                }));
            }
            return cart;
        });

        return res.render('user/checkout', {
            cart: cartList,
            address: checkoutData.addressList || [], 
            coupons: checkoutData.coupons || [],
            wallet: checkoutData.wallet || { balance: 0 },
            totalPriceBeforeDiscount: checkoutData.totalPriceBeforeDiscount || 0,
            appliedCoupon: appliedCoupon,
            addressSelected: checkoutData.addressSelected || false,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error("Checkout page loading breakdown:", error.message);
        return res.status(500).send(`Checkout Error: ${error.message}`);
    }
};

const selectAddress = async (req, res) => {
    try { 
        const userId = req.session.user?.id || req.session.user?._id || req.session.user_id;
        const { addressId } = req.body;

        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        await User.updateOne(
            { _id: userId, "addresses.isSelected": true },
            { $set: { "addresses.$.isSelected": false } }
        );

        await User.updateOne(
            { _id: userId, "addresses._id": addressId },
            { $set: { "addresses.$.isSelected": true } }
        );

        return res.status(200).json({ success: true }); 
    } catch (error) { 
        console.error("Select address error:", error);
        return res.status(500).json({ success: false, message: error.message }); 
    }
};

const editAddress = async (req, res) => {
    try { 
        const userId = req.session.user?.id || req.session.user?._id || req.session.user_id;
        if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

        const { fullname, phone, pincode, address, city, addressType, addressId } = req.body;

        if (!address || !pincode) {
            return res.status(400).json({ success: false, message: "Street Address and Pincode are required." });
        }

        const userDoc = await User.findById(userId);
        if (!userDoc) {
            return res.status(404).json({ success: false, message: "User record not found." });
        }

        const computedCity = (city || (address.includes(',') ? address.split(',')[0] : "Bengaluru")).trim();
        const computedName = (fullname || userDoc.username || "Valued Customer").trim();
        const computedPhone = (phone || userDoc.phone || "0000000000").trim();

        // Check if updating an existing address ID
        if (addressId && addressId.trim() !== "" && addressId !== "undefined") {
            const addressSubDoc = userDoc.addresses.id(addressId);
            if (addressSubDoc) {
                addressSubDoc.fullname = computedName;
                addressSubDoc.phone = computedPhone;
                addressSubDoc.address = address.trim();
                addressSubDoc.city = computedCity;
                addressSubDoc.pincode = pincode.trim();
                addressSubDoc.addressType = addressType || 'Home';
                addressSubDoc.isSelected = true;

                // Unselect all other addresses
                userDoc.addresses.forEach(addr => {
                    if (String(addr._id) !== String(addressId)) {
                        addr.isSelected = false;
                    }
                });

                await userDoc.save();
                return res.status(200).json({ success: true, message: "Address updated successfully." });
            }
        }

        // Add New Address flow
        userDoc.addresses.forEach(addr => {
            addr.isSelected = false;
        });

        userDoc.addresses.push({
            fullname: computedName,
            phone: computedPhone,
            address: address.trim(),
            city: computedCity,
            pincode: pincode.trim(),
            addressType: addressType || 'Home',
            isSelected: true
        });

        await userDoc.save();
        return res.status(200).json({ success: true, message: "Address saved successfully." }); 
    } catch (error) { 
        console.error("Save address crash detail:", error);
        return res.status(500).json({ success: false, message: error.message || "Server issue while saving address." }); 
    }
};

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user?.id || req.session.user?._id || req.session.user_id;
        if (!userId) return res.status(401).json({ success: false, message: "Session expired." });

        const { addressId, cartId, totalPriceBeforeDiscount, payablePrice, discountAmount, paymentMethod, couponId } = req.body;

        const sessionCoupon = req.session.appliedCoupon;
        const finalDiscount = discountAmount ?? sessionCoupon?.discountAmount ?? 0;
        const finalCouponId = couponId ?? sessionCoupon?.id ?? null;

        if (paymentMethod === 'COD' && payablePrice >= 100000) {
            return res.status(400).json({ success: false, message: "Cash on Delivery is not allowed for transactions of ₹1,00,000 or above." });
        }

        const orderResult = await checkoutService.createOrder({
            userId, 
            addressId, 
            cartId, 
            totalPriceBeforeDiscount, 
            payablePrice, 
            discountAmount: finalDiscount, 
            paymentMethod, 
            couponId: finalCouponId
        });

        if (orderResult.success) {
            delete req.session.appliedCoupon;
            req.session.lastOrderId = orderResult.orderId;
            return res.status(200).json({ success: true, orderId: orderResult.orderId });
        } else {
            return res.status(400).json({ success: false, message: orderResult.message || "Order placement failed." });
        }
    } catch (error) {
        console.error("Place order processing crash:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal server error." });
    }
};

// --- RAZORPAY ---

const createRazorpayOrder = async (req, res) => {
    try {
        const { payablePrice } = req.body;

        if (!payablePrice || payablePrice <= 0) {
            return res.status(400).json({ success: false, message: "Invalid payment amount." });
        }

        const options = {
            amount: Math.round(payablePrice * 100),
            currency: 'INR',
            receipt: `izen_rcpt_${Date.now()}`
        };

        const razorpayOrder = await razorpay.orders.create(options);

        return res.status(200).json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            razorpayOrderId: razorpayOrder.id
        });
    } catch (error) {
        console.error("Error creating Razorpay Order:", error);
        return res.status(500).json({ success: false, message: "Could not initialize payment with Razorpay." });
    }
};

const verifyRazorpayPayment = async (req, res) => {
    try {
        const userId = req.session.user?.id || 
                       req.session.user?._id || 
                       req.session.user_id || 
                       (typeof req.session.user === 'string' ? req.session.user : null) || 
                       req.user?._id || 
                       req.user?.id;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Session expired. Please refresh and log in again." });
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderPayload } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Missing required payment verification details." });
        }

        const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
        hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const generatedSignature = hmac.digest('hex');

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Payment verification failed. Invalid signature." });
        }

        const sessionCoupon = req.session.appliedCoupon;
        const finalDiscount = orderPayload.discountAmount ?? sessionCoupon?.discountAmount ?? 0;
        const finalCouponId = orderPayload.couponId ?? sessionCoupon?.id ?? null;

        const orderResult = await checkoutService.createOrder({
            userId,
            addressId: orderPayload.addressId,
            cartId: orderPayload.cartId,
            totalPriceBeforeDiscount: orderPayload.totalPriceBeforeDiscount,
            payablePrice: orderPayload.payablePrice,
            discountAmount: finalDiscount,
            paymentMethod: orderPayload.paymentMethod || 'Razorpay',
            couponId: finalCouponId,
            paymentStatus: 'Paid',
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id
        });

        if (orderResult.success) {
            delete req.session.appliedCoupon;
            req.session.lastOrderId = orderResult.orderId;
            return res.status(200).json({ success: true, orderId: orderResult.orderId });
        } else {
            return res.status(400).json({ success: false, message: orderResult.message || "Failed to finalize order record." });
        }
    } catch (error) {
        console.error("Error verifying Razorpay payment:", error);
        return res.status(500).json({ success: false, message: error.message || "Internal server error verifying payment." });
    }
};

// --- END RAZORPAY ---

const getOrderSuccessPage = async (req, res) => {
    const orderId = req.session.lastOrderId || "IZN-" + Math.floor(100000 + Math.random() * 900000);
    return res.render('user/orderSuccess', { orderId });
};

const getMyOrdersPage = async (req, res) => {
    try {
        const userId = req.session.user?.id || req.session.user?._id || req.session.user_id;
        if (!userId) return res.redirect('/login');

        const dbOrdersList = await Order.find({ user: userId }).sort({ createdAt: -1 }).lean();

        return res.render('user/ordersList', { 
            orders: dbOrdersList || [] 
        });
    } catch (error) {
        console.error("Error generating orders page:", error);
        return res.status(500).send("Internal Server Error loading order tracking.");
    }
};

const getOrderDetailsPage = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        const orderDoc = await Order.findById(orderId).populate('items.product').lean();
        
        if (!orderDoc) {
            return res.status(404).send("Order data record not found.");
        }

        const calculatedSubtotal = orderDoc.subtotal || orderDoc.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        const discountVal = orderDoc.discountAmount || 0;
        const shippingVal = 50;
        const calculatedTotal = orderDoc.totalAmount || (calculatedSubtotal - discountVal + shippingVal);

        const formattedOrderForView = {
            _id: orderDoc._id.toString(), 
            orderId: orderDoc.orderId,
            date: new Date(orderDoc.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
            status: orderDoc.items[0]?.status || 'Pending Delivery',
            paymentMethod: orderDoc.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : orderDoc.paymentMethod,
            shippingAddress: {
                fullname: orderDoc.shippingAddress.name,
                address: orderDoc.shippingAddress.addressLine,
                pincode: orderDoc.shippingAddress.pincode,
                phone: orderDoc.shippingAddress.phone
            },
            items: orderDoc.items.map(item => {
                let productColor = item.variantColor;

                if (!productColor || productColor === "Standard Config" || productColor === "Default") {
                    if (item.product && item.product.variants) {
                        const matchingVariant = item.product.variants.find(v => String(v._id) === String(item.variantId));
                        
                        if (matchingVariant && matchingVariant.attributes && matchingVariant.attributes.color) {
                            productColor = matchingVariant.attributes.color;
                        } else if (matchingVariant && matchingVariant.color) {
                            productColor = matchingVariant.color;
                        }
                    }
                }

                if (!productColor || productColor === "Standard Config") {
                    productColor = "Standard Edition";
                }

                return {
                    name: item.name,
                    variant: productColor, 
                    quantity: item.quantity,
                    price: item.price,
                    image: item.product && item.product.images && item.product.images.length > 0 ? item.product.images[0] : "/images/login.png",
                    variantId: item.variantId,
                    status: item.status ? item.status.toLowerCase() : 'pending' 
                };
            }),
            summary: {
                subtotal: calculatedSubtotal,
                shipping: shippingVal,
                discount: discountVal,
                total: calculatedTotal
            }
        };

        return res.render('user/ordersDetails', { order: formattedOrderForView });
    } catch (error) {
        console.error("Error loading specific order breakdown:", error);
        return res.status(500).send("Internal Server Error loading item specifics.");
    }
};

const cancelOrderItem = async (req, res) => {
    try {
        const { orderId, variantId, reason } = req.body;
        const result = await checkoutService.cancelOrderItem(orderId, variantId, reason);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error("Cancel item error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const returnOrderItem = async (req, res) => {
    try {
        const { orderId, variantId, reason } = req.body;
        
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found." });

        const itemIndex = order.items.findIndex(item => String(item.variantId) === String(variantId));
        if (itemIndex === -1) return res.status(404).json({ success: false, message: "Item not found in order." });

        const currentStatus = order.items[itemIndex].status.toLowerCase();
        if (currentStatus !== 'delivered') {
            return res.status(400).json({ success: false, message: "Returns can only be requested for delivered products." });
        }

        order.items[itemIndex].status = 'Return Request Pending';
        order.items[itemIndex].returnReason = reason || "User submitted return request.";

        await order.save();
        return res.status(200).json({ success: true, message: "Return request forwarded successfully. Awaiting admin approval." });
    } catch (error) {
        console.error("Return item error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        const order = await Order.findById(orderId).populate('items.product');
        if (!order) {
            return res.status(404).send("Invoice error: Order not found.");
        }

        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderId}.pdf`);
        doc.pipe(res);

        doc.fillColor('#1d1d1f').fontSize(24).font('Helvetica-Bold').text('iZen', 50, 50);
        doc.fontSize(10).font('Helvetica').fillColor('#86868b').text('Premium Tech Ecosystem', 50, 80);

        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1d1d1f').text('INVOICE', 350, 50, { width: 195, align: 'right' });
        doc.fontSize(9).font('Helvetica').fillColor('#6e6e73')
           .text(`Invoice ID: #INV-${order.orderId}`, 350, 72, { width: 195, align: 'right' })
           .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 350, 88, { width: 195, align: 'right' });

        doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#e5e5ea').lineWidth(1).stroke();

        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1d1d1f').text('Shipping Details', 50, 135);
        doc.fontSize(10).font('Helvetica').fillColor('#333333')
           .text(order.shippingAddress.name, 50, 155)
           .text(order.shippingAddress.addressLine, 50, 170)
           .text(`Pincode: ${order.shippingAddress.pincode}`, 50, 185)
           .text(`Phone: ${order.shippingAddress.phone}`, 50, 200);

        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1d1d1f').text('Payment Method', 350, 135);
        doc.fontSize(10).font('Helvetica').fillColor('#333333')
           .text(order.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : order.paymentMethod, 350, 155)
           .text(`Payment Status: Verified`, 350, 170);

        doc.moveTo(50, 230).lineTo(545, 230).strokeColor('#e5e5ea').stroke();

        let yPosition = 255;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1d1d1f');
        doc.text('Item Description', 50, yPosition);
        doc.text('Price', 300, yPosition, { width: 80, align: 'right' });
        doc.text('Qty', 395, yPosition, { width: 40, align: 'center' });
        doc.text('Total', 455, yPosition, { width: 90, align: 'right' });

        doc.moveTo(50, yPosition + 15).lineTo(545, yPosition + 15).strokeColor('#e5e5ea').stroke();
        yPosition += 25;

        doc.font('Helvetica').fillColor('#333333');
        order.items.forEach(item => {
            const itemTotal = item.price * item.quantity;
            const displayName = item.name + (item.variantColor ? ` (${item.variantColor})` : '');

            doc.text(displayName, 50, yPosition, { width: 240 });
            doc.text(`Rs. ${item.price.toLocaleString('en-IN')}`, 300, yPosition, { width: 80, align: 'right' }); 
            doc.text(item.quantity.toString(), 395, yPosition, { width: 40, align: 'center' });
            doc.text(`Rs. ${itemTotal.toLocaleString('en-IN')}`, 455, yPosition, { width: 90, align: 'right' });   

            yPosition += 25;
        });

        const calculatedSubtotal = order.subtotal || order.items.reduce((acc, i) => acc + (i.price * i.quantity), 0);
        const discountValue = order.discountAmount || 0;
        const finalTotal = order.totalAmount || (calculatedSubtotal - discountValue + 50);

        yPosition += 15;
        doc.moveTo(300, yPosition).lineTo(545, yPosition).strokeColor('#e5e5ea').stroke();
        yPosition += 10;

        doc.fontSize(10).fillColor('#6e6e73');
        doc.text('Subtotal:', 300, yPosition);
        doc.fillColor('#1d1d1f').text(`Rs. ${calculatedSubtotal.toLocaleString('en-IN')}`, 455, yPosition, { width: 90, align: 'right' });

        yPosition += 18;
        doc.fillColor('#6e6e73').text('Discount:', 300, yPosition);
        doc.fillColor('#1d1d1f').text(`-Rs. ${discountValue.toLocaleString('en-IN')}`, 455, yPosition, { width: 90, align: 'right' });

        yPosition += 18;
        doc.fillColor('#6e6e73').text('Shipping Charges:', 300, yPosition);
        doc.fillColor('#1d1d1f').text('Rs. 50', 455, yPosition, { width: 90, align: 'right' });

        yPosition += 22;
        doc.moveTo(300, yPosition).lineTo(545, yPosition).strokeColor('#e5e5ea').stroke();
        yPosition += 10;

        doc.fontSize(12).font('Helvetica-Bold').fillColor('#1d1d1f').text('Grand Total:', 300, yPosition);
        doc.text(`Rs. ${finalTotal.toLocaleString('en-IN')}`, 455, yPosition, { width: 90, align: 'right' });

        doc.fontSize(9).font('Helvetica').fillColor('#86868b').text('Thank you for shopping with iZen! For support, reach out to help@izen.com', 50, 720, { align: 'center', width: 495 });

        doc.end();
    } catch (error) {
        console.error("PDF generation crash:", error);
        return res.status(500).send("Internal server error generating document invoice download asset.");
    }
};

const cancelAllOrderItems = async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.session.user?.id || req.session.user?._id || req.session.user_id;

        if (!userId) return res.status(401).json({ success: false, message: "Session unauthenticated." });

        const result = await checkoutService.cancelAllOrderItems(orderId, userId);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error("Bulk cancellation processing crash:", error);
        return res.status(500).json({ success: false, message: "Internal server error processing bulk cancellation." });
    }
};

const returnAllOrderItems = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        const userId = req.session.user?.id || req.session.user?._id || req.session.user_id;

        if (!userId) return res.status(401).json({ success: false, message: "Session unauthenticated." });

        const order = await Order.findOne({ _id: orderId, user: userId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found." });

        const eligibleForReturn = order.items.some(item => item.status.toLowerCase() === 'delivered');
        if (!eligibleForReturn) {
            return res.status(400).json({ success: false, message: "Bulk returns are only restricted to orders containing delivered contents." });
        }

        for (const item of order.items) {
            if (item.status.toLowerCase() === 'delivered') {
                item.status = 'Return Request Pending'; 
                item.returnReason = reason || "Bulk order return request.";
            }
        }

        order.status = 'Return Request Pending'; 
        await order.save();
        return res.status(200).json({ success: true, message: "Bulk return request forwarded to administration queue." });
    } catch (error) {
        console.error("Bulk return processing crash:", error);
        return res.status(500).json({ success: false, message: "Internal server error logging bulk return tracking." });
    }
};

const getPaymentFailurePage = async (req, res) => {
    const errorReason = req.query.reason || "Payment transaction was incomplete or declined.";
    return res.render('user/paymentFailure', { errorReason });
};

const applyCoupon = async (req, res) => {
    try {
        const userId = req.session.user?.id || req.session.user?._id || req.session.user_id;
        const { couponCode, subtotal } = req.body;

        const result = await checkoutService.validateAndApplyCoupon(couponCode, subtotal, userId);

        if (result.success) {
            req.session.appliedCoupon = {
                id: result.couponId,
                code: result.code,
                discountAmount: result.discountAmount
            };
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error("Apply coupon error:", error);
        return res.status(500).json({ success: false, message: "Error applying coupon." });
    }
};

const removeCoupon = async (req, res) => {
    try {
        delete req.session.appliedCoupon;
        return res.status(200).json({ success: true, message: "Coupon removed." });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Error removing coupon." });
    }
};

module.exports = {
    getCheckoutPage,
    selectAddress,
    editAddress,
    placeOrder,
    createRazorpayOrder,
    verifyRazorpayPayment,
    getOrderSuccessPage,
    getMyOrdersPage,
    getOrderDetailsPage,
    cancelOrderItem,
    returnOrderItem,
    downloadInvoice,
    cancelAllOrderItems,
    returnAllOrderItems,
    getPaymentFailurePage,
    applyCoupon,
    removeCoupon
};