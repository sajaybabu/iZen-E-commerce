const Order = require('../../models/orderModel');
const User = require('../../models/userModel'); 
const Product = require('../../models/Product'); 

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

    const oldStatus = targetedItem.status;
    const oldStatusNormalized = oldStatus.trim().toLowerCase();
    const newStatusNormalized = newStatus.trim().toLowerCase();

    // End state lock validation
    if (oldStatusNormalized === 'cancelled' || oldStatusNormalized === 'returned') {
        throw new Error(`Cannot change status. This item has already been ${oldStatus.toLowerCase()} and is locked.`);
    }

    // Protection rule for "Returned" approval authorization
    if (newStatusNormalized === 'returned') {
        if (oldStatusNormalized !== 'return request pending' && oldStatusNormalized !== 'return review') {
            throw new Error("Action Denied: Admin cannot mark this item as 'Returned' until the user submits a return request.");
        }
    }

    // Protection rule for manual "Cancelled" choices by admin
    if (newStatusNormalized === 'cancelled') {
        if (oldStatusNormalized !== 'pending' && oldStatusNormalized !== 'processing') {
            throw new Error("Action Denied: Admin cannot cancel this item once it has progressed to distribution.");
        }
    }

    // Standard Forward Tracking Architecture Rules
    if (oldStatusNormalized === 'delivered') {
        if (newStatusNormalized !== 'delivered' && newStatusNormalized !== 'returned') {
            throw new Error("Cannot revert a delivered item back to a previous logistics state.");
        }
    }

    if ((oldStatusNormalized === 'shipped' || oldStatusNormalized === 'out for delivery') && newStatusNormalized === 'pending') {
        throw new Error(`Cannot roll back status to pending once the item has been ${oldStatus.toLowerCase()}.`);
    }
    
    // Array sub-document updates execution
    const updatedOrder = await Order.findOneAndUpdate(
        { 
            _id: orderId, 
            "items.variantId": variantId 
        },
        { 
            $set: { "items.$.status": newStatus } 
        }, 
        { new: true }
    );

    if (!updatedOrder) return null;

    // Fixed Restocking Stock Pipeline Controls
    const isRestockingState = ['cancelled', 'returned'].includes(newStatusNormalized);
    const wasAlreadyRestocked = ['cancelled', 'returned'].includes(oldStatusNormalized);

    if (isRestockingState && !wasAlreadyRestocked) {
        // Corrected mapping structure to prevent Casting crashes
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
    else if (!isRestockingState && wasAlreadyRestocked) {
        await Product.findOneAndUpdate(
            { 
                _id: targetedItem.product, 
                "variants._id": variantId 
            },
            { 
                $inc: { 
                    "variants.$.quantity": -targetedItem.quantity,
                    "stock": -targetedItem.quantity 
                } 
            }
        );
    }

    // Settlement balance actions
    let paymentUpdate = {};

    if (updatedOrder.paymentMethod === 'COD' && newStatus === 'Delivered') {
        paymentUpdate.paymentStatus = 'Paid';
    } 
    else if (newStatus === 'Cancelled' && updatedOrder.paymentMethod !== 'COD') {
        paymentUpdate.paymentStatus = 'Refunded';
    }

    if (Object.keys(paymentUpdate).length > 0) {
        return await Order.findByIdAndUpdate(
            orderId,
            { $set: paymentUpdate },
            { new: true }
        );
    }

    return updatedOrder;
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