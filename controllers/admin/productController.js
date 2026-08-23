const productService = require('../../services/admin/productService');

exports.createProduct = async (req, res) => {
    try {
        if (!req.body.variantsDataJSON) {
            return res.status(400).json({
                success: false,
                message: "Product variants data is missing."
            });
        }

        await productService.createProduct(req.body, req.files);

        return res.status(200).json({
            success: true,
            message: "Product added successfully!"
        });

    } catch (error) {
        console.error("createProduct error:", error);
        return res.status(500).json({
            success: false,
            message: "Server Error: Unable to complete product entry."
        });
    }
};

exports.getAllProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = 5; 
        const skip = (page - 1) * limit;

        const products = await productService.getAllProducts({ skip, limit });
        const totalProducts = await productService.countProducts({}); 

        const totalPages = Math.ceil(totalProducts / limit) || 1;

        res.render('admin/productManagement', {
            products,
            searchQuery: '',
            isSearchPage: false,
            currentPage: page,
            totalPages: totalPages,
            prevPage: page - 1,
            nextPage: page + 1,
            prevDisable: page === 1 ? 'disabled' : '',
            nextDisable: page >= totalPages ? 'disabled' : ''
        });

    } catch (error) {
        console.error("getAllProducts error:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.getAddProductPage = async (req, res) => {
    try {
        const categories = await productService.getCategoriesForAddPage();
        res.render('admin/addproduct', { categories });
    } catch (error) {
        console.error("getAddProductPage error:", error);
        res.status(500).redirect('/admin/products');
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const deletedProduct = await productService.deleteProduct(req.params.id);

        if (!deletedProduct) {
            return res.status(404).json({
                success: false,
                message: "Product record not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product successfully moved to trash."
        });

    } catch (error) {
        console.error("deleteProduct error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server anomaly encountered."
        });
    }
};

exports.searchProducts = async (req, res) => {
    try {
        const name = req.query.name || req.body.name;

        if (!name || name.trim() === "") {
            return res.redirect('/admin/products');
        }

        const searchQueryText = name.trim();

        const page = parseInt(req.query.page, 10) || 1;
        const limit = 5; 
        const skip = (page - 1) * limit;

        const products = await productService.searchProducts({ 
            name: searchQueryText, 
            skip, 
            limit 
        });

        const totalMatchingProducts = await productService.countSearchProducts(searchQueryText);
        const totalPages = Math.ceil(totalMatchingProducts / limit) || 1;

        res.render('admin/productManagement', {
            products,
            searchQuery: searchQueryText,
            isSearchPage: true,
            currentPage: page,
            totalPages: totalPages,
            prevPage: page - 1,
            nextPage: page + 1,
            prevDisable: page === 1 ? 'disabled' : '',
            nextDisable: page >= totalPages ? 'disabled' : ''
        });

    } catch (error) {
        console.error("searchProducts error:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.getEditProductPage = async (req, res) => {
    try {
        const product = await productService.getProductById(req.params.id);

        if (!product || product.isDeleted) {
            return res.status(404).send("Error: Product not found or has been deleted.");
        }
        
        res.render('admin/editproduct', { product });
    } catch (error) {
        console.error("getEditProductPage error:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.updateProduct = async (req, res) => {
    try {
        if (!req.body.variantsDataJSON) {
            return res.status(400).json({
                success: false,
                message: "Variant information is missing."
            });
        }

        await productService.updateProduct(
            req.params.id,
            req.body,
            req.files
        );

        return res.status(200).json({
            success: true,
            message: "The asset records and variant fields have updated successfully."
        });

    } catch (error) {
        console.error("updateProduct error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error updating database fields."
        });
    }
};