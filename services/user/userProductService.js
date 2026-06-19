const Product = require('../../models/Product');
const Category = require('../../models/categoryModel'); 
const mongoose = require('mongoose');

// Definitive methods for handling shop listings and single product views
const getAllProductsData = async (filterParams) => {
  try {
    const { page, search, category, minPrice, maxPrice, sort } = filterParams;
    const limit = 8;
    const currentPage = parseInt(page) || 1;
    const skip = (currentPage - 1) * limit;

    // Base query: only pull active, non-deleted inventory
    let query = { isBlocked: false, isDeleted: false };

    //  Safe Text Search
    if (search && search.trim() !== "") {
      query.name = { $regex: new RegExp(search.trim(), 'i') };
    }

    // SAFE CATEGORY PARSING WITH CASE-INSENSITIVE REGEX PATTERN 
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
        delete query.$or; // Remove root level clashing $or key
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

    // Fetch live categories for selection bars
    const categories = await Category.find({ isListed: true });

    // Execute paginated selection query
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
    // Fetch parent product configuration safely
    const productDoc = await Product.findOne({ 
      'variants._id': variantId, 
      isBlocked: false, 
      isDeleted: false 
    });
    
    if (!productDoc) return null;

    // Safe Category Lookup (Prevents any CastErrors if category is stored as plain text string)
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

    // Securely redirect if parent category has been unlisted by an admin
    if (!parentCategory || parentCategory.isListed === false) {
      return null;
    }

    // Extract sub-variant instance reference cleanly
    const activeVariant = productDoc.variants.id(variantId);
    if (!activeVariant) return null;
    
    //related recommendations inside the exact same category ecosystem
    const exploreMore = await Product.find({ 
      _id: { $ne: productDoc._id }, 
      category: productDoc.category,
      isBlocked: false,
      isDeleted: false 
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