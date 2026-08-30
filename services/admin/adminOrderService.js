const Order = require('../../models/orderModel');
const User = require('../../models/userModel'); 
const Product = require('../../models/Product'); 
const Wallet = require('../../models/walletModel'); 

const processWalletRefund = async ({ userId, refundAmount, orderObjectId, itemTitle, purpose }) => {
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
        wallet = new Wallet({
            userId,
            balance: 0,
            transactions: []
        });
    }

    wallet.balance += refundAmount;

    wallet.transactions.push({
        amount: refundAmount,
        type: 'credit',
        purpose: purpose, 
        orderId: orderObjectId,
        description: `Refund credited for product: ${itemTitle}`
    });

    await wallet.save();
    return wallet;
};

const fetchAllOrdersWithUsers = async () => {
    return await Order.find()
        .populate('user', 'username email')
        .sort({ createdAt: -1 });
};

const getOrderById = async (orderId) => {
    return await Order.findById(orderId)
        .populate('user', 'username email');
};

const updateIndividualItemStatus = async (orderId, variantId, newStatus) => {
    const existingOrder = await Order.findById(orderId);
    if (!existingOrder) return null;

    const targetedItem = existingOrder.items.find(item => 
        item.variantId && item.variantId.toString() === variantId.toString()
    );

    if (!targetedItem) {
        console.error(`Admin Sync Failure: Variant with ID ${variantId} not located in order document ${orderId}`);
        return null;
    }

    const oldStatus = targetedItem.status || '';
    const oldStatusNormalized = oldStatus.trim().toLowerCase();
    const newStatusNormalized = newStatus.trim().toLowerCase();

    if (oldStatusNormalized === 'cancelled' || oldStatusNormalized === 'returned') {
        throw new Error(`Cannot change status. This item has already been ${oldStatus.toLowerCase()} and is locked.`);
    }

    if (newStatusNormalized === 'returned') {
        if (oldStatusNormalized !== 'return request pending' && oldStatusNormalized !== 'return review') {
            throw new Error("Action Denied: Admin cannot mark this item as 'Returned' until the user submits a return request.");
        }
    }

    if (newStatusNormalized === 'cancelled') {
        if (oldStatusNormalized !== 'pending' && oldStatusNormalized !== 'processing') {
            throw new Error("Action Denied: Admin cannot cancel this item once it has progressed to distribution.");
        }
    }

    if (oldStatusNormalized === 'delivered') {
        if (newStatusNormalized !== 'delivered' && newStatusNormalized !== 'returned') {
            throw new Error("Cannot revert a delivered item back to a previous logistics state.");
        }
    }

    if ((oldStatusNormalized === 'shipped' || oldStatusNormalized === 'out for delivery') && newStatusNormalized === 'pending') {
        throw new Error(`Cannot roll back status to pending once the item has been ${oldStatus.toLowerCase()}.`);
    }

    // Execute item status update
    targetedItem.status = newStatus;

    // Proportional Refund Math for Item Level Actions
    let grossItemAmount = targetedItem.price * targetedItem.quantity;
    let netRefundAmount = grossItemAmount;

    if (existingOrder.subtotal > 0 && existingOrder.discountAmount > 0) {
        const itemProportion = grossItemAmount / existingOrder.subtotal;
        netRefundAmount = Math.round(grossItemAmount - (existingOrder.discountAmount * itemProportion));
    }

    // Recalculate whole order status and total amount if cancelled or returned
    if (['cancelled', 'returned'].includes(newStatusNormalized)) {
        const hasActiveItems = existingOrder.items.some(i => !['cancelled', 'returned'].includes(i.status.toLowerCase()));
        
        if (!hasActiveItems) {
            existingOrder.status = newStatusNormalized === 'returned' ? 'Returned' : 'Cancelled';
            existingOrder.totalAmount = 0;
        } else {
            existingOrder.totalAmount = Math.max(0, existingOrder.totalAmount - netRefundAmount);
        }
    }

    // Restocking Pipeline
    const isRestockingState = ['cancelled', 'returned'].includes(newStatusNormalized);
    const wasAlreadyRestocked = ['cancelled', 'returned'].includes(oldStatusNormalized);

    if (isRestockingState && !wasAlreadyRestocked) {
        await Product.findOneAndUpdate(
            { 
                _id: targetedItem.product, 
                "variants._id": variantId 
            },
            { 
                $inc: { 
                    "variants.$.quantity": targetedItem.quantity,
                    "stock": targetedItem.quantity 
                } 
            }
        );
    }

    // Wallet Refunds
    if (newStatusNormalized === 'returned') {
        await processWalletRefund({
            userId: existingOrder.user,
            refundAmount: netRefundAmount,
            orderObjectId: existingOrder._id,
            itemTitle: targetedItem.name,
            purpose: 'Order Return'
        });
    }

    if (newStatusNormalized === 'cancelled' && existingOrder.paymentMethod !== 'COD') {
        await processWalletRefund({
            userId: existingOrder.user,
            refundAmount: netRefundAmount,
            orderObjectId: existingOrder._id,
            itemTitle: targetedItem.name,
            purpose: 'Order Cancellation'
        });
    }

    // Payment Status Updates
    if (existingOrder.paymentMethod === 'COD' && newStatusNormalized === 'delivered') {
        existingOrder.paymentStatus = 'Paid';
    } else if (newStatusNormalized === 'returned' || (newStatusNormalized === 'cancelled' && existingOrder.paymentMethod !== 'COD')) {
        const hasActiveItems = existingOrder.items.some(i => !['cancelled', 'returned'].includes(i.status.toLowerCase()));
        if (!hasActiveItems) {
            existingOrder.paymentStatus = 'Refunded';
        }
    }

    return await existingOrder.save();
};

const fetchFilteredOrders = async ({ page, limit, search, status, sort }) => {
    const skip = (page - 1) * limit;
    let query = {};

    if (status && status !== 'All') {
        query['items.status'] = status;
    }

    if (search) {
        const searchRegex = new RegExp(search.trim(), 'i');

        const matchingUsers = await User.find({
            $or: [
                { username: searchRegex },
                { email: searchRegex }
            ]
        }).select('_id');

        const userIds = matchingUsers.map(user => user._id);

        query.$or = [
            { orderId: searchRegex },
            { 'items.name': searchRegex }, 
            { user: { $in: userIds } }
        ];
    }

    let sortOption = { createdAt: -1 }; 
    if (sort === 'oldest') {
        sortOption = { createdAt: 1 };
    } else if (sort === 'amount-high') {
        sortOption = { totalAmount: -1 };
    } else if (sort === 'amount-low') {
        sortOption = { totalAmount: 1 };
    }

    const [orders, totalOrders] = await Promise.all([
        Order.find(query)
            .populate('user', 'username email')
            .sort(sortOption)
            .skip(skip)
            .limit(limit),
        Order.countDocuments(query)
    ]);

    return { orders, totalOrders };
};

module.exports = {
    fetchAllOrdersWithUsers,
    getOrderById,
    updateIndividualItemStatus, 
    fetchFilteredOrders 
};