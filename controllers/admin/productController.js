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

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Server Error: Unable to complete product entry."
        });
    }
};

exports.getAllProducts = async (req, res) => {
    try {

        const products =
            await productService.getAllProducts();

        res.render('admin/productManagement', {
            products,
            searchQuery: '',
            isSearchPage: false,
            prevPage: 1,
            nextPage: 1,
            prevDisable: 'disabled',
            nextDisable: 'disabled'
        });

    } catch (error) {

        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};

exports.getAddProductPage = async (req, res) => {
    try {

        const categories =
            await productService.getCategoriesForAddPage();

        res.render('admin/addproduct', {
            categories
        });

    } catch (error) {

        console.error(error);
        res.status(500).redirect('/admin/products');
    }
};

exports.deleteProduct = async (req, res) => {
    try {

        const deletedProduct =
            await productService.deleteProduct(req.params.id);

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

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal server anomaly encountered."
        });
    }
};

exports.searchProducts = async (req, res) => {
    try {

        const { name } = req.body;

        if (!name || name.trim() === "") {
            return res.redirect('/admin/products');
        }

        const products =
            await productService.searchProducts(name);

        res.render('admin/productManagement', {
            products,
            searchQuery: name,
            isSearchPage: true,
            prevPage: 1,
            nextPage: 1,
            prevDisable: 'disabled',
            nextDisable: 'disabled'
        });

    } catch (error) {

        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};

exports.getEditProductPage = async (req, res) => {
    try {

        const product =
            await productService.getProductById(req.params.id);

        if (!product || product.isDeleted) {
            return res.status(404).send(
                "Error: Product not found or has been deleted."
            );
        }

        res.render('admin/editproduct', {
            product
        });

    } catch (error) {

        console.error(error);
        res.status(500).send("Internal Server Error");
    }
};

exports.updateProduct = async (req, res) => {
    try {

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

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error updating database fields."
        });
    }
};