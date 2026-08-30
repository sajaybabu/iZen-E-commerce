const checkoutService = require('../../services/user/checkoutService');
const userService = require('../../services/user/userService');
const PDFDocument = require('pdfkit');
const User = require('../../models/userModel');
const Order = require('../../models/orderModel'); 
const crypto = require('crypto');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const SHIPPING_CHARGE = 50;

const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user?.id || req.session.user?._id || req.session.user_id; 
        if (!userId) return res.redirect('/login');

        const checkoutData = await checkoutService.getCheckoutData(userId) || {};
        const appliedCoupon = req.session.appliedCoupon || null;

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

                userDoc.addresses.forEach(addr => {
                    if (String(addr._id) !== String(addressId)) {
                        addr.isSelected = false;
                    }
                });

                await userDoc.save();
                return res.status(200).json({ success: true, message: "Address updated successfully." });
            }
        }

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
        const shippingVal = SHIPPING_CHARGE;
        const calculatedTotal = orderDoc.totalAmount;

        const formattedOrderForView = {
            _id: orderDoc._id.toString(), 
            orderId: orderDoc.orderId,
            date: new Date(orderDoc.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }),
            status: orderDoc.status || orderDoc.items[0]?.status || 'Pending',
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

        const doc = new PDFDocument({ size: 'A4', margin: 40 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderId}.pdf`);
        doc.pipe(res);

        // Header section
        doc.fillColor('#1d1d1f').fontSize(22).font('Helvetica-Bold').text('iZen', 40, 40);
        doc.fontSize(9).font('Helvetica').fillColor('#86868b').text('Apple Ecosystem Hub', 40, 66);

        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1d1d1f').text('TAX INVOICE', 350, 40, { width: 205, align: 'right' });
        doc.fontSize(8.5).font('Helvetica').fillColor('#6e6e73')
           .text(`Invoice Ref: #INV-${order.orderId}`, 350, 60, { width: 205, align: 'right' })
           .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 350, 74, { width: 205, align: 'right' });

        doc.moveTo(40, 95).lineTo(555, 95).strokeColor('#e5e5ea').lineWidth(1).stroke();

        // Customer & Order Info
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1d1d1f').text('Billed & Shipped To:', 40, 110);
        doc.fontSize(9).font('Helvetica').fillColor('#333333')
           .text(order.shippingAddress.name, 40, 126)
           .text(order.shippingAddress.addressLine, 40, 140)
           .text(`Pincode: ${order.shippingAddress.pincode}`, 40, 154)
           .text(`Phone: ${order.shippingAddress.phone}`, 40, 168);

        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1d1d1f').text('Payment Details:', 350, 110);
        doc.fontSize(9).font('Helvetica').fillColor('#333333')
           .text(`Method: ${order.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : order.paymentMethod}`, 350, 126)
           .text(`Status: ${order.paymentStatus}`, 350, 140);

        doc.moveTo(40, 192).lineTo(555, 192).strokeColor('#e5e5ea').stroke();

        // Items Table Header
        let yPosition = 205;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1d1d1f');
        doc.text('Item Description', 40, yPosition);
        doc.text('Unit Price', 300, yPosition, { width: 75, align: 'right' });
        doc.text('Qty', 385, yPosition, { width: 35, align: 'center' });
        doc.text('Amount', 430, yPosition, { width: 125, align: 'right' });

        doc.moveTo(40, yPosition + 14).lineTo(555, yPosition + 14).strokeColor('#e5e5ea').stroke();
        yPosition += 22;

        // Active Items (Excluding cancelled items from invoice)
        const validItems = order.items.filter(item => item.status.toLowerCase() !== 'cancelled');
        let activeSubtotal = 0;

        doc.font('Helvetica').fontSize(9).fillColor('#333333');
        validItems.forEach(item => {
            const lineTotal = item.price * item.quantity;
            activeSubtotal += lineTotal;
            const displayName = item.name + (item.variantColor ? ` (${item.variantColor})` : '');

            doc.text(displayName, 40, yPosition, { width: 250 });
            doc.text(`Rs. ${item.price.toLocaleString('en-IN')}`, 300, yPosition, { width: 75, align: 'right' }); 
            doc.text(item.quantity.toString(), 385, yPosition, { width: 35, align: 'center' });
            doc.text(`Rs. ${lineTotal.toLocaleString('en-IN')}`, 430, yPosition, { width: 125, align: 'right' });   

            yPosition += 20;
        });

        // Summary Calculations
        const discountVal = order.discountAmount || 0;
        const shippingVal = validItems.length > 0 ? SHIPPING_CHARGE : 0;
        const calculatedGrandTotal = Math.max(0, activeSubtotal - discountVal + shippingVal);

        yPosition += 10;
        doc.moveTo(300, yPosition).lineTo(555, yPosition).strokeColor('#e5e5ea').stroke();
        yPosition += 10;

        doc.fontSize(9).fillColor('#6e6e73');
        doc.text('Subtotal:', 300, yPosition);
        doc.fillColor('#1d1d1f').text(`Rs. ${activeSubtotal.toLocaleString('en-IN')}`, 430, yPosition, { width: 125, align: 'right' });

        yPosition += 16;
        doc.fillColor('#6e6e73').text('Discount:', 300, yPosition);
        doc.fillColor('#1d1d1f').text(`-Rs. ${discountVal.toLocaleString('en-IN')}`, 430, yPosition, { width: 125, align: 'right' });

        yPosition += 16;
        doc.fillColor('#6e6e73').text('Shipping Charges:', 300, yPosition);
        doc.fillColor('#1d1d1f').text(`Rs. ${shippingVal}`, 430, yPosition, { width: 125, align: 'right' });

        yPosition += 20;
        doc.moveTo(300, yPosition).lineTo(555, yPosition).strokeColor('#e5e5ea').stroke();
        yPosition += 10;

        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1d1d1f').text('Grand Total:', 300, yPosition);
        doc.text(`Rs. ${calculatedGrandTotal.toLocaleString('en-IN')}`, 430, yPosition, { width: 125, align: 'right' });

        // Single-page pinned footer
        doc.fontSize(8.5).font('Helvetica').fillColor('#86868b').text('Thank you for shopping with iZen! For assistance, email support@izen.com', 40, 750, { align: 'center', width: 515 });

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