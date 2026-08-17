const Product = require('../../models/Product');
const Category = require('../../models/categoryModel'); 
const mongoose = require('mongoose');

/**
 * Calculates highest discount offer between Product offer and Category offer
 */
const calculateOfferDetails = (product, categoryDoc) => {
  const prodOffer = Number(product.productOffer) || 0;
  const catOffer = categoryDoc ? (Number(categoryDoc.discount) || 0) : 0;
  return Math.max(prodOffer, catOffer);
};

const getAllProductsData = async (filterParams) => {
  try {
    const { page, search, category, minPrice, maxPrice, sort } = filterParams;
    const limit = 8;
    const currentPage = parseInt(page) || 1;
    const skip = (currentPage - 1) * limit;

    //  Fetch unlisted or deleted categories
    const hiddenCategories = await Category.find({ 
      $or: [{ isListed: false }, { isDeleted: true }] 
    }).lean();

    const hiddenCategoryNames = hiddenCategories.map(cat => new RegExp(`^${cat.name.trim()}$`, 'i'));
    const hiddenCategoryIds = hiddenCategories.map(cat => cat._id.toString());

    //  Fetch all active categories into a lookup map for offer processing
    const allActiveCategories = await Category.find({ isListed: true, isDeleted: { $ne: true } }).lean();
    const categoryMap = new Map();
    allActiveCategories.forEach(cat => {
      categoryMap.set(cat._id.toString(), cat);
      categoryMap.set(cat.name.toLowerCase().trim(), cat);
    });

    //  Base Query
    let query = { 
      isBlocked: false, 
      isDeleted: false,
      category: { $nin: [...hiddenCategoryNames, ...hiddenCategoryIds] }
    };

    if (search && search.trim() !== "") {
      query.name = { $regex: new RegExp(search.trim(), 'i') };
    }

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

    //  Fetch matching products
    let rawProducts = await Product.find(query).lean();

    //  Compute dynamic offer calculations across all product variants
    let processedProducts = rawProducts.map(prod => {
      let matchedCategory = null;
      if (prod.category) {
        const catKey = prod.category.toString().toLowerCase().trim();
        matchedCategory = categoryMap.get(catKey) || null;
      }

      const bestOffer = calculateOfferDetails(prod, matchedCategory);

      if (prod.variants && prod.variants.length > 0) {
        prod.variants = prod.variants.map(v => {
          const unitPrice = Number(v.price || v.unitPrice) || 0;
          const discountAmount = Math.round((unitPrice * bestOffer) / 100);
          const finalPrice = Math.max(0, unitPrice - discountAmount);

          return {
            ...v,
            unitPrice,
            finalPrice,
            offerPercentage: bestOffer
          };
        });
      }

      return prod;
    });

    //  Apply Price Range Filter on calculated finalPrice
    if (minPrice || maxPrice) {
      const min = minPrice ? Number(minPrice) : 0;
      const max = maxPrice ? Number(maxPrice) : Infinity;

      processedProducts = processedProducts.filter(prod => {
        const firstVar = prod.variants && prod.variants[0];
        const targetPrice = firstVar ? firstVar.finalPrice : 0;
        return targetPrice >= min && targetPrice <= max;
      });
    }

    //  Sort products based on calculated prices
    if (sort === 'priceLowToHigh') {
      processedProducts.sort((a, b) => ((a.variants[0]?.finalPrice || 0) - (b.variants[0]?.finalPrice || 0)));
    } else if (sort === 'priceHighToLow') {
      processedProducts.sort((a, b) => ((b.variants[0]?.finalPrice || 0) - (a.variants[0]?.finalPrice || 0)));
    } else if (sort === 'aa-zz') {
      processedProducts.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'zz-aa') {
      processedProducts.sort((a, b) => b.name.localeCompare(a.name));
    } else {
      processedProducts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    //  Paginate computed collection
    const totalProducts = processedProducts.length;
    const paginatedProducts = processedProducts.slice(skip, skip + limit);
    const totalPages = Math.ceil(totalProducts / limit);

    return {
      products: paginatedProducts,
      categories: allActiveCategories,
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
    }).lean();
    
    if (!productDoc) return null;

    // Find parent category details
    let parentCategory = null;
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(productDoc.category);

    if (isValidObjectId) {
      parentCategory = await Category.findOne({
        $or: [
          { _id: productDoc.category },
          { name: productDoc.category }
        ]
      }).lean();
    } else {
      parentCategory = await Category.findOne({ name: productDoc.category }).lean();
    }

    if (!parentCategory || parentCategory.isListed === false || parentCategory.isDeleted === true) {
      return null;
    }

    // Compute best offer for product & variants
    const bestOffer = calculateOfferDetails(productDoc, parentCategory);

    productDoc.category = parentCategory;
    productDoc.variants = productDoc.variants.map(v => {
      const unitPrice = Number(v.price || v.unitPrice) || 0;
      const discountAmount = Math.round((unitPrice * bestOffer) / 100);
      const finalPrice = Math.max(0, unitPrice - discountAmount);

      return {
        ...v,
        unitPrice,
        finalPrice,
        offerPercentage: bestOffer
      };
    });

    const activeVariant = productDoc.variants.find(v => String(v._id) === String(variantId)) || productDoc.variants[0];
    if (!activeVariant) return null;
    
    // Fetch suggestions for Explore More
    const hiddenCategories = await Category.find({ $or: [{ isListed: false }, { isDeleted: true }] }).lean();
    const hiddenCategoryNames = hiddenCategories.map(cat => new RegExp(`^${cat.name.trim()}$`, 'i'));
    const hiddenCategoryIds = hiddenCategories.map(cat => cat._id.toString());

    let exploreMore = await Product.find({ 
      _id: { $ne: productDoc._id }, 
      category: productDoc.category._id || productDoc.category.name,
      isBlocked: false,
      isDeleted: false,
      category: { $nin: [...hiddenCategoryNames, ...hiddenCategoryIds] }
    }).limit(4).lean();

    exploreMore = exploreMore.map(p => {
      const offer = calculateOfferDetails(p, parentCategory);
      if (p.variants && p.variants[0]) {
        const uPrice = Number(p.variants[0].price || p.variants[0].unitPrice) || 0;
        p.variants[0].unitPrice = uPrice;
        p.variants[0].finalPrice = Math.max(0, uPrice - Math.round((uPrice * offer) / 100));
        p.variants[0].offerPercentage = offer;
      }
      return p;
    });

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