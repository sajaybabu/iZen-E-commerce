const Category = require('../../models/categoryModel');

const loadCategories = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        
        const searchWord = req.query.search ? req.query.search.trim() : "";

        const queryCondition = { isDeleted: { $ne: true } };

        if (searchWord !== "") {
            queryCondition.name = { $regex: searchWord, $options: 'i' };
        }

        const count = await Category.countDocuments(queryCondition);
        
        const categories = await Category.find(queryCondition)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.render('admin/category', {
            cat: categories,
            currentPage: page,
            totalPages: Math.ceil(count / limit) || 1,
            search: searchWord 
        });
    } catch (error) {
        console.error("Error loading categories:", error);
        res.status(500).send("Error loading categories");
    }
};

const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        
        const existing = await Category.findOne({ 
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            isDeleted: { $ne: true }
        });
        
        if (existing) {
            return res.status(400).json({ message: "Category name already exists" });
        }

        const newCat = new Category({
            name: name.trim(),
            description: description.trim()
        });
        await newCat.save();

        res.status(200).json({ message: "Category added successfully" });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.body; 
        await Category.findByIdAndUpdate(id, { isDeleted: true });
        res.json({ success: true, message: "Category moved to trash" });
    } catch (error) {
        res.status(500).json({ success: false });
    }
};

const loadEditCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const category = await Category.findById(id);

        if (!category || category.isDeleted) {
            return res.redirect('/admin/category');
        }

        res.render('admin/editCategory', { category });
    } catch (error) {
        console.error("Load Edit Category Error:", error);
        res.status(500).send("Internal Server Error");
    }
};

const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, isListed } = req.body;

        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
            _id: { $ne: id },
            isDeleted: { $ne: true }
        });

        if (existingCategory) {
            return res.status(400).json({ success: false, message: "Category name already exists" });
        }

        await Category.findByIdAndUpdate(id, {
            name: name.trim(),
            description: description.trim(),
            isListed: isListed === 'true' || isListed === true
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Update Category Error:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

const blockCategory = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, message: "Category ID is required." });

        const updatedCategory = await Category.findByIdAndUpdate(id, { isListed: false }, {returnDocument: 'after'});
        if (!updatedCategory) return res.status(404).json({ success: false, message: "Category not found." });

        return res.status(200).json({ success: true, message: "Category blocked successfully." });
    } catch (error) {
        console.error("Error blocking category:", error);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
};

const unBlockCategory = async (req, res) => {
    try {
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, message: "Category ID is required." });

        const updatedCategory = await Category.findByIdAndUpdate(id, { isListed: true }, {returnDocument: 'after'});
        if (!updatedCategory) return res.status(404).json({ success: false, message: "Category not found." });

        return res.status(200).json({ success: true, message: "Category unblocked successfully." });
    } catch (error) {
        console.error("Error unblocking category:", error);
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