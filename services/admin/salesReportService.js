const Order = require('../../models/orderModel');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit-table');

/**
 * Calculates start and end dates based on filter type or custom inputs
 */
const getDateRange = (filterType, startDate, endDate) => {
    let start = new Date();
    let end = new Date();
    end.setHours(23, 59, 59, 999);

    if (filterType === 'daily') {
        start.setHours(0, 0, 0, 0);
    } else if (filterType === 'weekly') {
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
    } else if (filterType === 'yearly') {
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
    } else if (filterType === 'custom' && startDate && endDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
    } else {
        // Default to last 30 days
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
    }

    return { start, end };
};

/**
 * Fetch sales data, calculate overall sales count, revenue, and discounts
 */
const getSalesReportData = async (filterType, startDate, endDate) => {
    const { start, end } = getDateRange(filterType, startDate, endDate);

    const query = {
        createdAt: { $gte: start, $lte: end },
        paymentStatus: { $ne: 'Failed' } // Exclude failed transactions
    };

    const orders = await Order.find(query)
        .populate('user', 'name email')
        .sort({ createdAt: -1 });

    // Aggregate summary numbers
    let overallSalesCount = orders.length;
    let overallOrderAmount = 0;
    let overallDiscount = 0;

    orders.forEach(order => {
        overallOrderAmount += order.totalAmount || 0;
        overallDiscount += order.discountAmount || 0;
    });

    return {
        orders,
        summary: {
            overallSalesCount,
            overallOrderAmount,
            overallDiscount
        },
        dateRange: { start, end },
        filterType: filterType || 'custom'
    };
};

/**
 * Generate Excel (.xlsx) file stream
 */
const generateExcelReport = async (res, reportData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'Date', key: 'date', width: 15 },
        { header: 'Customer', key: 'customer', width: 25 },
        { header: 'Payment Method', key: 'paymentMethod', width: 15 },
        { header: 'Subtotal (₹)', key: 'subtotal', width: 15 },
        { header: 'Discount (₹)', key: 'discount', width: 15 },
        { header: 'Total Amount (₹)', key: 'total', width: 15 }
    ];

    reportData.orders.forEach(order => {
        worksheet.addRow({
            orderId: order.orderId,
            date: new Date(order.createdAt).toLocaleDateString(),
            customer: order.user ? order.user.name : 'N/A',
            paymentMethod: order.paymentMethod,
            subtotal: order.subtotal,
            discount: order.discountAmount,
            total: order.totalAmount
        });
    });

    // Summary Section
    worksheet.addRow({});
    worksheet.addRow({ orderId: 'SUMMARY' });
    worksheet.addRow({ orderId: 'Total Sales Count', date: reportData.summary.overallSalesCount });
    worksheet.addRow({ orderId: 'Total Order Amount', date: reportData.summary.overallOrderAmount });
    worksheet.addRow({ orderId: 'Total Discount Amount', date: reportData.summary.overallDiscount });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=SalesReport_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
};

/**
 * Generate PDF file stream
 */
const generatePdfReport = async (res, reportData) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=SalesReport_${Date.now()}.pdf`);

    doc.pipe(res);

    // Title & Summary
    doc.fontSize(18).text('iZEN - Sales Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).text(`Date Range: ${reportData.dateRange.start.toDateString()} to ${reportData.dateRange.end.toDateString()}`);
    doc.text(`Total Orders: ${reportData.summary.overallSalesCount}`);
    doc.text(`Total Revenue: RS. ${reportData.summary.overallOrderAmount}`);
    doc.text(`Total Discounts Given: RS. ${reportData.summary.overallDiscount}`);
    doc.moveDown();

    // Table Setup
    const table = {
        title: "Order Details",
        headers: ["Order ID", "Date", "Customer", "Payment", "Discount", "Total"],
        rows: reportData.orders.map(order => [
            order.orderId,
            new Date(order.createdAt).toLocaleDateString(),
            order.user ? order.user.name : 'N/A',
            order.paymentMethod,
            `RS. ${order.discountAmount}`,
            `RS. ${order.totalAmount}`
        ])
    };

    await doc.table(table, {
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
        prepareRow: (row, index, column, rect, rowNumber) => doc.font("Helvetica").fontSize(9)
    });

    doc.end();
};

module.exports = {
    getSalesReportData,
    generateExcelReport,
    generatePdfReport
};