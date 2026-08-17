const salesReportService = require('../../services/admin/salesReportService');

const loadSalesReport = async (req, res) => {
    try {
        const { filterType, startDate, endDate } = req.query;
        const reportData = await salesReportService.getSalesReportData(filterType, startDate, endDate);

        res.render('admin/salesReport', {
            orders: reportData.orders,
            summary: reportData.summary,
            filterType: reportData.filterType,
            startDate: startDate || '',
            endDate: endDate || ''
        });
    } catch (error) {
        console.error('Error loading sales report:', error);
        res.status(500).render('error', { message: 'Failed to load sales report' });
    }
};

const downloadExcelReport = async (req, res) => {
    try {
        const { filterType, startDate, endDate } = req.query;
        const reportData = await salesReportService.getSalesReportData(filterType, startDate, endDate);
        await salesReportService.generateExcelReport(res, reportData);
    } catch (error) {
        console.error('Error generating Excel report:', error);
        res.status(500).send('Failed to generate Excel report');
    }
};

const downloadPdfReport = async (req, res) => {
    try {
        const { filterType, startDate, endDate } = req.query;
        const reportData = await salesReportService.getSalesReportData(filterType, startDate, endDate);
        await salesReportService.generatePdfReport(res, reportData);
    } catch (error) {
        console.error('Error generating PDF report:', error);
        res.status(500).send('Failed to generate PDF report');
    }
};

module.exports = {
    loadSalesReport,
    downloadExcelReport,
    downloadPdfReport
};