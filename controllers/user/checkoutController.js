const checkoutService = require('../../services/user/checkoutService');
const PDFDocument = require('pdfkit');
const User = require('../../models/userModel');
const Order = require('../../models/orderModel'); 
const Product = require('../../models/Product');

const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user?.id || req.session.user?._id || req.session.user_id; 
        if (!userId) return res.redirect('/login');

        const checkoutData = await checkoutService.getCheckoutData(userId) || {};

        return res.render('user/checkout', {
            cart: checkoutData.cart || [],
            address: checkoutData.addressList || [], 
            coupons: checkoutData.coupons || [],
            wallet: checkoutData.wallet || { balance: 0 },
            totalPriceBeforeDiscount: checkoutData.totalPriceBeforeDiscount || 0,
            addressSelected: checkoutData.addressSelected || false
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

        const { fullname, phone, email, pincode, address, addressType, addressId } = req.body;

        if (addressId) {
            await User.updateOne(
                { _id: userId, "addresses._id": addressId },
                { 
                    $set: { 
                        "addresses.$.fullname": fullname,
                        "addresses.$.phone": phone,
                        "addresses.$.email": email,
                        "addresses.$.pincode": pincode,
                        "addresses.$.address": address,
                        "addresses.$.addressType": addressType
                    } 
                }
            );
        } else {
            await User.updateOne(
                { _id: userId, "addresses.isSelected": true },
                { $set: { "addresses.$.isSelected": false } }
            );

            const newAddressObject = {
                fullname,
                phone,
                email,
                pincode,
                address,
                addressType,
                isSelected: true
            };

            await User.findByIdAndUpdate(userId, {
                $push: { addresses: newAddressObject }
            });
        }

        return res.status(200).json({ success: true }); 
    } catch (error) { 
        console.error("Save address error:", error);
        return res.status(500).json({ success: false, message: error.message }); 
    }
};

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user?.id || req.session.user?._id || req.session.user_id;
        if (!userId) return res.status(401).json({ success: false, message: "Session expired." });

        const { addressId, cartId, totalPriceBeforeDiscount, payablePrice, discountAmount, paymentMethod, couponId } = req.body;

        if (paymentMethod === 'COD' && payablePrice >= 100000) {
            return res.status(400).json({ success: false, message: "Cash on Delivery is not allowed for transactions of ₹1,00,000 or above." });
        }

        const orderResult = await checkoutService.createOrder({
            userId, addressId, cartId, totalPriceBeforeDiscount, payablePrice, discountAmount, paymentMethod, couponId
        });

        if (orderResult.success) {
            req.session.lastOrderId = orderResult.orderId;
            return res.status(200).json({ success: true, orderId: orderResult.orderId });
        } else {
            return res.status(400).json({ success: false, message: orderResult.message || "Order placement failed." });
        }
    } catch (error) {
        console.error("Place order processing crash:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
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
                let productColor = item.variantColor || "Default";
                if ((productColor === "Default" || !productColor) && item.product && item.product.variants) {
                    const matchingVariant = item.product.variants.find(v => String(v._id) === String(item.variantId));
                    if (matchingVariant && matchingVariant.color) {
                        productColor = matchingVariant.color;
                    }
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
                subtotal: orderDoc.subtotal,
                shipping: 50,
                discount: orderDoc.discountAmount || 0,
                total: orderDoc.totalAmount
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
        
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found." });

        const itemIndex = order.items.findIndex(item => String(item.variantId) === String(variantId));
        if (itemIndex === -1) return res.status(404).json({ success: false, message: "Item not found in order." });
        
        if (order.items[itemIndex].status === 'Cancelled') {
            return res.status(400).json({ success: false, message: "Item is already cancelled." });
        }

        order.items[itemIndex].status = 'Cancelled';
        order.items[itemIndex].cancellationReason = reason || "No reason provided";

        const targetItem = order.items[itemIndex];
        await Product.findOneAndUpdate(
            { _id: targetItem.product, "variants._id": targetItem.variantId },
            { 
                $inc: { 
                    "variants.$.quantity": targetItem.quantity,
                    "stock": targetItem.quantity 
                } 
            }
        );

        const itemCost = targetItem.price * targetItem.quantity;
        order.totalAmount = Math.max(0, order.totalAmount - itemCost);
        order.subtotal = Math.max(0, order.subtotal - itemCost);

        await order.save();
        return res.status(200).json({ success: true });
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

        order.items[itemIndex].status = 'Returned';
        order.items[itemIndex].returnReason = reason;

        await order.save();
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("Return item error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;
        
        // Fetch the full order document with populated product data
        const order = await Order.findById(orderId).populate('items.product');
        if (!order) {
            return res.status(404).send("Invoice error: Order not found.");
        }

        // Initialize a clean, blank PDF canvas
        const doc = new PDFDocument({ size: 'A4', margin: 50 });

        // Stream configuration to trigger an immediate automatic download in browser
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${order.orderId}.pdf`);
        doc.pipe(res);

        // PDF DESIGN 

        //  BRAND HEADER SECTION
        doc.fillColor('#1d1d1f').fontSize(24).font('Helvetica-Bold').text('iZen', 50, 50);
        doc.fontSize(10).font('Helvetica').fillColor('#86868b').text('Premium Tech Ecosystem', 50, 80);

        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1d1d1f').text('INVOICE', 350, 50, { width: 195, align: 'right' });
        doc.fontSize(9).font('Helvetica').fillColor('#6e6e73')
           .text(`Invoice ID: #INV-${order.orderId}`, 350, 72, { width: 195, align: 'right' })
           .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 350, 88, { width: 195, align: 'right' });

        // Simple divider rule
        doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#e5e5ea').lineWidth(1).stroke();

        // SHIPPING & PAYMENT DETAILS 
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

        // Another divider rule
        doc.moveTo(50, 230).lineTo(545, 230).strokeColor('#e5e5ea').stroke();

        //  PRODUCTS TABLE HEADER 
        let yPosition = 255;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1d1d1f');
        doc.text('Item Description', 50, yPosition);
        doc.text('Price', 300, yPosition, { width: 80, align: 'right' });
        doc.text('Qty', 395, yPosition, { width: 40, align: 'center' });
        doc.text('Total', 455, yPosition, { width: 90, align: 'right' });

        // Table Header underline
        doc.moveTo(50, yPosition + 15).lineTo(545, yPosition + 15).strokeColor('#e5e5ea').stroke();
        yPosition += 25;

        // LOOPING THROUGH ITEMS 
        doc.font('Helvetica').fillColor('#333333');
        order.items.forEach(item => {
            const itemTotal = item.price * item.quantity;
            const displayName = item.name + (item.variantColor ? ` (${item.variantColor})` : '');

            doc.text(displayName, 50, yPosition, { width: 240 });
            doc.text(`Rs. ${item.price.toLocaleString('en-IN')}`, 300, yPosition, { width: 80, align: 'right' }); // 🌟 Fixed currency prefix
            doc.text(item.quantity.toString(), 395, yPosition, { width: 40, align: 'center' });
            doc.text(`Rs. ${itemTotal.toLocaleString('en-IN')}`, 455, yPosition, { width: 90, align: 'right' });   // 🌟 Fixed currency prefix

            yPosition += 25;
        });

        // SUMMARY CALCULATION BLOCK 
        yPosition += 15;
        doc.moveTo(300, yPosition).lineTo(545, yPosition).strokeColor('#e5e5ea').stroke();
        yPosition += 10;

        doc.fontSize(10).fillColor('#6e6e73');
        doc.text('Subtotal:', 300, yPosition);
        doc.fillColor('#1d1d1f').text(`Rs. ${order.subtotal.toLocaleString('en-IN')}`, 455, yPosition, { width: 90, align: 'right' });

        yPosition += 18;
        doc.fillColor('#6e6e73').text('Discount:', 300, yPosition);
        doc.fillColor('#1d1d1f').text(`-Rs. ${(order.discountAmount || 0).toLocaleString('en-IN')}`, 455, yPosition, { width: 90, align: 'right' });

        yPosition += 18;
        doc.fillColor('#6e6e73').text('Shipping Charges:', 300, yPosition);
        doc.fillColor('#1d1d1f').text('Rs. 50', 455, yPosition, { width: 90, align: 'right' });

        yPosition += 22;
        doc.moveTo(300, yPosition).lineTo(545, yPosition).strokeColor('#e5e5ea').stroke();
        yPosition += 10;

        doc.fontSize(12).font('Helvetica-Bold').fillColor('#1d1d1f').text('Grand Total:', 300, yPosition);
        doc.text(`Rs. ${order.totalAmount.toLocaleString('en-IN')}`, 455, yPosition, { width: 90, align: 'right' });

        // FOOTER NOTE
        doc.fontSize(9).font('Helvetica').fillColor('#86868b').text('Thank you for shopping with iZen! For support, reach out to help@izen.com', 50, 720, { align: 'center', width: 495 });

        // Finalize document compilation
        doc.end();
    } catch (error) {
        console.error("PDF generation crash:", error);
        return res.status(500).send("Internal server error generating document invoice download asset.");
    }
};

module.exports = {
    getCheckoutPage,
    selectAddress,
    editAddress,
    placeOrder,
    getOrderSuccessPage,
    getMyOrdersPage,
    getOrderDetailsPage,
    cancelOrderItem,
    returnOrderItem,
    downloadInvoice
};