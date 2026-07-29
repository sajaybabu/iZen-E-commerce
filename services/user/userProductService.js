const Product = require('../../models/Product');
const Category = require('../../models/categoryModel'); 
const mongoose = require('mongoose');

const getAllProductsData = async (filterParams) => {
  try {
    const { page, search, category, minPrice, maxPrice, sort } = filterParams;
    const limit = 8;
    const currentPage = parseInt(page) || 1;
    const skip = (currentPage - 1) * limit;

    // Fetch all categories that are unlisted or deleted by admin
    const hiddenCategories = await Category.find({ 
      $or: [{ isListed: false }, { isDeleted: true }] 
    }).lean();

    // Collect names and ObjectIDs of hidden categories 
    const hiddenCategoryNames = hiddenCategories.map(cat => new RegExp(`^${cat.name.trim()}$`, 'i'));
    const hiddenCategoryIds = hiddenCategories.map(cat => cat._id.toString());

    // exclude blocked, deleted, or products belonging to hidden categories
    let query = { 
      isBlocked: false, 
      isDeleted: false,
      category: { $nin: [...hiddenCategoryNames, ...hiddenCategoryIds] }
    };

    // Safe Text Search
    if (search && search.trim() !== "") {
      query.name = { $regex: new RegExp(search.trim(), 'i') };
    }

    // Safe Category Parsing with filtering logic
    if (category && category !== 'all') {
      if (mongoose.Types.ObjectId.isValid(category)) {
        const foundCategory = await Category.findById(category);
        if (foundCategory) {
          const caseInsensitiveCategoryRegex = new RegExp(`^${foundCategory.name.trim()}$`, 'i');
          query.$or = [
            { category: caseInsensitiveCategoryRegex },
            { category: new mongoose.Types.ObjectId(category) },
            { category: category }
          ];
        } else {
          query.category = category;
        }
      } else {
        query.category = new RegExp(`^${category.trim()}$`, 'i');
      }
    }

    // Price boundary configurations
    if (minPrice || maxPrice) {
      const priceFilter = [
        { "variants.price": {} },
        { "variants.unitPrice": {} }
      ];
      
      if (minPrice) {
        priceFilter[0]["variants.price"].$gte = Number(minPrice);
        priceFilter[1]["variants.unitPrice"].$gte = Number(minPrice);
      }
      if (maxPrice) {
        priceFilter[0]["variants.price"].$lte = Number(maxPrice);
        priceFilter[1]["variants.unitPrice"].$lte = Number(maxPrice);
      }

      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          { $or: priceFilter }
        ];
        delete query.$or; 
      } else {
        query.$or = priceFilter;
      }
    }

    let sortQuery = {};
    switch (sort) {
      case 'priceLowToHigh': 
        sortQuery["variants.price"] = 1; 
        sortQuery["variants.unitPrice"] = 1; 
        break;
      case 'priceHighToLow': 
        sortQuery["variants.price"] = -1; 
        sortQuery["variants.unitPrice"] = -1; 
        break;
      case 'aa-zz': 
        sortQuery.name = 1; 
        break;
      case 'zz-aa': 
        sortQuery.name = -1; 
        break;
      default: 
        sortQuery.createdAt = -1; 
    }

    // Only load active sidebars selectors 
    const categories = await Category.find({ isListed: true, isDeleted: { $ne: true } });

    // Execute safe query mapping constraints
    const products = await Product.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    return {
      products,
      categories,
      totalPages,
      currentPage
    };

  } catch (error) {
    console.error("Database error in userProductService.getAllProductsData:", error);
    throw error;
  }
};

const getProductDetailData = async (variantId) => {
  try {
    const productDoc = await Product.findOne({ 
      'variants._id': variantId, 
      isBlocked: false, 
      isDeleted: false 
    });
    
    if (!productDoc) return null;

    let parentCategory = null;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(productDoc.category);

    if (isValidObjectId) {
      parentCategory = await Category.findOne({
        $or: [
          { _id: productDoc.category },
          { name: productDoc.category }
        ]
      });
    } else {
      parentCategory = await Category.findOne({ name: productDoc.category });
    }

    if (!parentCategory || parentCategory.isListed === false || parentCategory.isDeleted === true) {
      return null;
    }

    const activeVariant = productDoc.variants.id(variantId);
    if (!activeVariant) return null;
    
    // Fetch safe suggestions using unlisted configuration blocks
    const hiddenCategories = await Category.find({ $or: [{ isListed: false }, { isDeleted: true }] }).lean();
    const hiddenCategoryNames = hiddenCategories.map(cat => new RegExp(`^${cat.name.trim()}$`, 'i'));
    const hiddenCategoryIds = hiddenCategories.map(cat => cat._id.toString());

    const exploreMore = await Product.find({ 
      _id: { $ne: productDoc._id }, 
      category: productDoc.category,
      isBlocked: false,
      isDeleted: false,
      category: { $nin: [...hiddenCategoryNames, ...hiddenCategoryIds] }
    }).limit(4);

    return {
      product: productDoc,
      variant: activeVariant,
      variantOptions: productDoc.variants,
      exploreMore
    };
  } catch (error) {
    console.error("Database error in userProductService.getProductDetailData:", error);
    throw error;
  }
};

module.exports = {
  getAllProductsData,
  getProductDetailData
};