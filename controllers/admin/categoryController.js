const categoryService = require('../../services/admin/categoryService');
const Category = require('../../models/categoryModel'); 

const loadCategories = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const searchWord = req.query.search ? req.query.search.trim() : "";

        const result = await categoryService.getCategories(page, searchWord);

        res.render('admin/category', {
            cat: result.categories,
            currentPage: page,
            totalPages: result.totalPages,
            search: searchWord
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error loading categories");
    }
};

const addCategory = async (req, res) => {
    try {
        // Case-insensitive check to see if category name exists in database
        const existingCategory = await Category.findOne({ 
            name: { $regex: new RegExp(`^${req.body.name.trim()}$`, 'i') } 
        });

        if (existingCategory) {
            // If it exists and isn't deleted, throw a duplicate field block
            if (!existingCategory.isDeleted) {
                return res.status(400).json({ success: false, message: "Category already exists." });
            }

            // If it exists but was soft-deleted, revive, reset and save it!
            existingCategory.isDeleted = false;
            existingCategory.description = req.body.description;
            existingCategory.discount = Number(req.body.discount) || 0;
            existingCategory.isListed = req.body.isListed;
            
            await existingCategory.save();
            return res.status(200).json({ success: true, message: "Category restored successfully." });
        }

        // Create a totally fresh category record 
        const newCategory = new Category({
            name: req.body.name.trim(),
            description: req.body.description,
            discount: Number(req.body.discount) || 0,
            isListed: req.body.isListed
        });

        await newCategory.save();
        res.status(201).json({ success: true, message: "Category created successfully." });

    } catch (error) {
        console.error("Add Category Error:", error);
        res.status(500).json({ success: false, message: "Internal server error." });
    }
};

const deleteCategory = async (req, res) => {
    try {
        await categoryService.deleteCategory(req.body.id);
        res.json({ success: true, message: "Category moved to trash" });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

const loadEditCategory = async (req, res) => {
    try {
        const category = await categoryService.getCategoryById(req.params.id);

        if (!category || category.isDeleted) {
            return res.redirect('/admin/category');
        }

        res.render('admin/editCategory', { 
            categoryId: category._id, 
            editName: category.name,
            editDescription: category.description,
            editDiscount: category.discount || 0,
            editStatus: category.isListed ? 'active' : 'blocked'
        });
    } catch (error) {
        console.error("Load Edit Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

const updateCategory = async (req, res) => {
    try {
        const { newName, newDescription, newStatus, newDiscount } = req.body;
        const isListed = (newStatus === 'active');

        // Added support for updating discount values directly via the service layer wrapper
        await categoryService.updateCategory(
            req.params.id, 
            newName.trim(), 
            newDescription.trim(), 
            isListed,
            Number(newDiscount) || 0 // Pass discount payload explicitly to service
        );

        res.redirect('/admin/category');
    } catch (error) {
        console.error("Update Controller Error:", error);
        res.status(400).send("Failed to update category: " + error.message);
    }
};

const blockCategory = async (req, res) => {
    try {
        const updatedCategory = await categoryService.blockCategory(req.body.id);
        if (!updatedCategory) {
            return res.status(404).json({ success: false, message: "Category not found." });
        }
        return res.status(200).json({ success: true, message: "Category blocked successfully." });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

const unBlockCategory = async (req, res) => {
    try {
        const updatedCategory = await categoryService.unBlockCategory(req.body.id);
        if (!updatedCategory) {
            return res.status(404).json({ success: false, message: "Category not found." });
        }
        return res.status(200).json({ success: true, message: "Category unblocked successfully." });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

module.exports = {
    loadCategories,
    addCategory,
    loadAddCategory: (req, res) => res.render('admin/addCategory'),
    deleteCategory,
    loadEditCategory,
    updateCategory,
    blockCategory,
    unBlockCategory
};