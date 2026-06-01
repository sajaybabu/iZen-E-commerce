const Category = require('../../models/categoryModel');

const getCategories = async (page, searchWord) => {

    const limit = 5;
    const skip = (page - 1) * limit;

    const queryCondition = {
        isDeleted: { $ne: true }
    };

    if (searchWord !== "") {
        queryCondition.name = {
            $regex: searchWord,
            $options: 'i'
        };
    }

    const count =
        await Category.countDocuments(queryCondition);

    const categories =
        await Category.find(queryCondition)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

    return {
        categories,
        totalPages: Math.ceil(count / limit) || 1
    };
};

const createCategory = async (name, description) => {

    const existing =
        await Category.findOne({
            name: {
                $regex: new RegExp(
                    `^${name.trim()}$`,
                    'i'
                )
            },
            isDeleted: { $ne: true }
        });

    if (existing) {
        throw new Error("Category name already exists");
    }

    const newCategory = new Category({
        name: name.trim(),
        description: description.trim()
    });

    return await newCategory.save();
};

const deleteCategory = async (id) => {
    return await Category.findByIdAndUpdate(
        id,
        { isDeleted: true }
    );
};

const getCategoryById = async (id) => {
    return await Category.findById(id);
};

const updateCategory = async (
    id,
    name,
    description,
    isListed
) => {

    const existingCategory =
        await Category.findOne({
            name: {
                $regex: new RegExp(
                    `^${name.trim()}$`,
                    'i'
                )
            },
            _id: { $ne: id },
            isDeleted: { $ne: true }
        });

    if (existingCategory) {
        throw new Error("Category name already exists");
    }

    return await Category.findByIdAndUpdate(
        id,
        {
            name: name.trim(),
            description: description.trim(),
            isListed:
                isListed === 'true' ||
                isListed === true
        }
    );
};

const blockCategory = async (id) => {

    return await Category.findByIdAndUpdate(
        id,
        { isListed: false },
        { returnDocument: 'after' }
    );
};

const unBlockCategory = async (id) => {

    return await Category.findByIdAndUpdate(
        id,
        { isListed: true },
        { returnDocument: 'after' }
    );
};

module.exports = {
    getCategories,
    createCategory,
    deleteCategory,
    getCategoryById,
    updateCategory,
    blockCategory,
    unBlockCategory
};