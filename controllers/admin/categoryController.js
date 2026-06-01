const categoryService = require('../../services/admin/categoryService');

const loadCategories = async (req, res) => {
    try {

        const page =
            parseInt(req.query.page, 10) || 1;

        const searchWord =
            req.query.search
                ? req.query.search.trim()
                : "";

        const result =
            await categoryService.getCategories(
                page,
                searchWord
            );

        res.render('admin/category', {
            cat: result.categories,
            currentPage: page,
            totalPages: result.totalPages,
            search: searchWord
        });

    } catch (error) {

        console.error(error);
        res.status(500).send(
            "Error loading categories"
        );
    }
};

const addCategory = async (req, res) => {
    try {

        const { name, description } = req.body;

        await categoryService.createCategory(
            name,
            description
        );

        res.status(200).json({
            message:
                "Category added successfully"
        });

    } catch (error) {

        res.status(400).json({
            message: error.message
        });
    }
};

const deleteCategory = async (req, res) => {
    try {

        await categoryService.deleteCategory(
            req.body.id
        );

        res.json({
            success: true,
            message:
                "Category moved to trash"
        });

    } catch (error) {

        res.status(500).json({
            success: false
        });
    }
};

const loadEditCategory = async (req, res) => {
    try {

        const category =
            await categoryService.getCategoryById(
                req.params.id
            );

        if (
            !category ||
            category.isDeleted
        ) {
            return res.redirect(
                '/admin/category'
            );
        }

        res.render(
            'admin/editCategory',
            { category }
        );

    } catch (error) {

        console.error(error);

        res.status(500).send(
            "Internal Server Error"
        );
    }
};

const updateCategory = async (req, res) => {
    try {

        const {
            name,
            description,
            isListed
        } = req.body;

        await categoryService.updateCategory(
            req.params.id,
            name,
            description,
            isListed
        );

        res.status(200).json({
            success: true
        });

    } catch (error) {

        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

const blockCategory = async (req, res) => {
    try {

        const updatedCategory =
            await categoryService.blockCategory(
                req.body.id
            );

        if (!updatedCategory) {
            return res.status(404).json({
                success: false,
                message:
                    "Category not found."
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Category blocked successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                "Internal server error."
        });
    }
};

const unBlockCategory = async (req, res) => {
    try {

        const updatedCategory =
            await categoryService.unBlockCategory(
                req.body.id
            );

        if (!updatedCategory) {
            return res.status(404).json({
                success: false,
                message:
                    "Category not found."
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Category unblocked successfully."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message:
                "Internal server error."
        });
    }
};

module.exports = {
    loadCategories,
    addCategory,
    loadAddCategory: (req, res) =>
        res.render('admin/addCategory'),
    deleteCategory,
    loadEditCategory,
    updateCategory,
    blockCategory,
    unBlockCategory
};