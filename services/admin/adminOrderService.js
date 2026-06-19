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

    // Added strict .toString() casting to fix type mismatch mismatch between ObjectId and String payload identifiers
    const targetedItem = existingOrder.items.find(item => 
        item.variantId && item.variantId.toString() === variantId.toString()
    );
    
    if (!targetedItem) {
        console.error(`Admin Sync Failure: Variant with ID ${variantId} not located in order document ${orderId}`);
        return null;
    }

    const oldStatus = targetedItem.status;

    //array sub-document updates
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

    //  INVENTORY STOCK MONITOR
    const isRestockingState = ['Cancelled', 'Returned'].includes(newStatus);
    const wasAlreadyRestocked = ['Cancelled', 'Returned'].includes(oldStatus);

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
    else if (!isRestockingState && wasAlreadyRestocked) {
        // if admin moves item from Canceled back to standard workflow
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

    //  TRANSACTION SETTLEMENT AUTOMATION LINKS
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