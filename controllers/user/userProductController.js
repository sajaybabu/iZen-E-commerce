const userProductService = require('../../services/user/userProductService');

const getAllProductsPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || "";
    const selectedCategory = req.query.category || "all";
    const minPrice = req.query.minPrice || "";
    const maxPrice = req.query.maxPrice || "";
    const selectedSort = req.query.sort || "";

    const shopData = await userProductService.getAllProductsData({
      page,
      search,
      category: selectedCategory,
      minPrice,
      maxPrice,
      sort: selectedSort
    });

    res.render('user/allProducts', {
      products: shopData.products,
      categories: shopData.categories,
      totalPages: shopData.totalPages,
      currentPage: shopData.currentPage,
      search,
      selectedCategory,
      minPrice,
      maxPrice,
      selectedSort,
      wishlist: req.session.wishlist || { items: [] }, 
      user: req.session.user || null
    });

  } catch (error) {
    console.error("Controller Error in getAllProductsPage:", error);
    // FIXED: Fallback to redirect instead of rendering a missing error view
    res.redirect('/');
  }
};

const getProductDetailPage = async (req, res) => {
  try {
    const variantId = req.params.id;
    const detailData = await userProductService.getProductDetailData(variantId);

    // If product is blocked, deleted, or category unlisted
    if (!detailData) {
      // If you have req.flash set up, use this:
      if (req.flash) req.flash('error', 'This product is currently unavailable.');
      
      // Otherwise, we pass a query string that your allProducts page can read
      return res.redirect('/allProducts?message=unavailable');
    }

    res.render('user/productDetail', {
      product: detailData.product,
      variant: detailData.variant,
      variantOptions: detailData.variantOptions,
      exploreMore: detailData.exploreMore, 
      wishlist: req.session.wishlist || { items: [] }, 
      user: req.session.user || null
    });

  } catch (error) {
    console.error("Controller Error in getProductDetailPage:", error);
    res.redirect('/allProducts');
  }
};

module.exports = {
  getAllProductsPage,
  getProductDetailPage
};