const adminOrderService = require('../../services/admin/adminOrderService');

const getAllOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10; 
        const search = req.query.search || '';
        const status = req.query.status || 'All';
        const sort = req.query.sort || 'latest';

        const { orders, totalOrders } = await adminOrderService.fetchFilteredOrders({
            page,
            limit,
            search,
            status,
            sort
        });

        const totalPages = Math.ceil(totalOrders / limit);

        res.render('admin/adminOrderList', { 
            orders, 
            title: "Order Dashboard",
            currentPage: page,
            totalPages,
            currentSearch: search,
            currentStatus: status,
            currentSort: sort,
            limit
        });
    } catch (error) {
        console.error("Error fetching admin orders in controller:", error);
        res.status(500).send("Internal Server Error loading order management dashboard.");
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        const order = await adminOrderService.getOrderById(orderId);

        if (!order) {
            return res.status(404).send("Order not found");
        }

        res.render('admin/adminOrderDetail', { 
            order, 
            title: `Inspect Order #${order.orderId}` 
        });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send("Internal Server Error fetching order details.");
    }
};

const updateItemStatus = async (req, res) => {
    try {
        const { orderId, variantId, status } = req.body;
        
        if (!orderId || !variantId || !status) {
            return res.status(400).json({ success: false, message: "Missing required tracking identifiers." });
        }

        const updatedOrder = await adminOrderService.updateIndividualItemStatus(orderId, variantId, status);
        
        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: "Target order or item configuration not located." });
        }
        
        return res.status(200).json({ success: true, message: "Product status synchronized successfully." });
    } catch (error) {
        console.error("Error modifying individual item status state:", error);
        return res.status(400).json({ success: false, message: error.message || "Internal server error updating item status." });
    }
};

module.exports = {
    getAllOrders,
    getOrderDetails,
    updateItemStatus 
};