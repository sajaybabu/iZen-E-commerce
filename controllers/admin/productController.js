const Product = require('../../models/Product');
const Category = require('../../models/categoryModel');

exports.createProduct = async (req, res) => {
    try {
        const { name, description, category, discount, variantsDataJSON, isFeatured } = req.body;

        if (!variantsDataJSON) {
            return res.status(400).json({ success: false, message: "Product variants data is missing." });
        }

        const submittedVariants = JSON.parse(variantsDataJSON);
        const variantArray = [];
        let globalImagesArray = []; 

        let totalStock = 0;
        let lowestPrice = Infinity;

        for (let i = 0; i < submittedVariants.length; i++) {
            const incomingVariant = submittedVariants[i];

            const vQty = parseInt(incomingVariant.quantity, 10) || 0;
            const vPrice = parseFloat(incomingVariant.price) || 0;

            totalStock += vQty;
            if (vPrice < lowestPrice) {
                lowestPrice = vPrice;
            }

            const targetKeyName = `variantImages_${i}`;
            const variantImages = req.files ? req.files
                .filter(file => file.fieldname === targetKeyName)
                .map(file => `/uploads/products/${file.filename}`) : [];

            globalImagesArray = globalImagesArray.concat(variantImages);

            variantArray.push({
                attributes: incomingVariant.attributes || {},
                quantity: vQty,
                price: vPrice,
                images: variantImages
            });
        }

        if (lowestPrice === Infinity) lowestPrice = 0;

        const newProduct = new Product({
            name,
            description,
            category,
            discount: parseFloat(discount) || 0,
            variants: variantArray,
            images: globalImagesArray, 
            price: lowestPrice,        
            stock: totalStock,    
            isBlocked: false,
            isDeleted: false,
            isFeatured: isFeatured === 'on' || isFeatured === true || isFeatured === 'true'
        });

        await newProduct.save();
        return res.status(200).json({ success: true, message: "Product added successfully!" });

    } catch (error) {
        console.error("Error creating product:", error);
        return res.status(500).json({ success: false, message: "Server Error: Unable to complete product entry." });
    }
};

exports.getAllProducts = async (req, res) => {
    try {
        const products = await Product.find({ isDeleted: { $ne: true } }).sort({ createdAt: -1 });
        
        res.render('admin/productManagement', { 
            products: products,
            searchQuery: '',
            isSearchPage: false,        
            prevPage: 1, 
            nextPage: 1,
            prevDisable: 'disabled',
            nextDisable: 'disabled'
        }); 
    } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.getAddProductPage = async (req, res) => {
    try {
        // Fetch categories that are explicitly listed AND not soft-deleted
        const categories = await Category.find({ 
            isListed: true, 
            isDeleted: { $ne: true } 
        }); 
        
        res.render('admin/addproduct', { 
            categories: categories 
        });
    } catch (error) {
        console.error("Error fetching categories for add product page:", error);
        res.status(500).redirect('/admin/products');
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params; 

        if (!id) {
            return res.status(400).json({ success: false, message: "No ID supplied to parameters." });
        }

        const softDeletedProduct = await Product.findByIdAndUpdate(id, { isDeleted: true }, { new: true });

        if (!softDeletedProduct) {
            return res.status(404).json({ success: false, message: "Product record not found." });
        }

        return res.status(200).json({ success: true, message: "Product successfully moved to trash." });
    } catch (error) {
        console.error("Router dynamic deletion exception:", error);
        return res.status(500).json({ success: false, message: "Internal server anomaly encountered." });
    }
};

exports.searchProducts = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim() === "") {
            return res.redirect('/admin/products');
        }

        const products = await Product.find({
            name: { $regex: name.trim(), $options: 'i' },
            isDeleted: { $ne: true }
        }).sort({ createdAt: -1 });

        res.render('admin/productManagement', { 
            products: products,
            searchQuery: name,          
            isSearchPage: true,         
            prevPage: 1, 
            nextPage: 1,
            prevDisable: 'disabled',
            nextDisable: 'disabled'
        }); 
    } catch (error) {
        console.error("Error searching products:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.getEditProductPage = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);

        if (!product || product.isDeleted) {
            return res.status(404).send("Error: Product not found or has been deleted.");
        }

        res.render('admin/editproduct', { product: product }); 
    } catch (error) {
        console.error("Error loading edit page view context:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, category, discount, variantsDataJSON } = req.body;

        const product = await Product.findOne({ _id: id, isDeleted: { $ne: true } });
        if (!product) {
            return res.status(404).send("Product not found.");
        }

        product.name = name;
        product.description = description;
        product.category = category;
        product.discount = parseInt(discount, 10) || 0;

        if (!variantsDataJSON) {
            return res.status(400).send("Variants dataset structure missing.");
        }

        const submittedVariants = JSON.parse(variantsDataJSON);
        const finalVariants = [];

        let totalQuantity = 0;
        let startingPrice = Infinity;

        for (let i = 0; i < submittedVariants.length; i++) {
            const incomingVariant = submittedVariants[i];
            let allocatedImages = (product.variants && product.variants[i]) ? product.variants[i].images : [];

            if (req.files && req.files.length > 0) {
                const targetKeyName = `variantImages_${i}`;
                const freshlyUploaded = req.files
                    .filter(file => file.fieldname === targetKeyName)
                    .map(file => `/uploads/products/${file.filename}`);

                if (freshlyUploaded.length > 0) {
                    allocatedImages = freshlyUploaded; 
                }
            }

            const vQty = parseInt(incomingVariant.quantity, 10) || 0;
            const vPrice = parseFloat(incomingVariant.price) || 0;

            totalQuantity += vQty;
            if (vPrice < startingPrice) {
                startingPrice = vPrice; 
            }

            finalVariants.push({
                attributes: incomingVariant.attributes || {},
                quantity: vQty,
                price: vPrice,
                images: allocatedImages
            });
        }

        if (startingPrice === Infinity) startingPrice = 0;

        product.variants = finalVariants;
        product.markModified('variants');
        product.price = startingPrice; 
        
        if (typeof product.stock !== 'undefined') {
            product.stock = totalQuantity;
        } else {
            product.quantity = totalQuantity;
        }

        await product.save();
        return res.sendStatus(200);

    } catch (error) {
        console.error("!!! CRITICAL CATCH REJECTION EXCEPTION DETAILS !!!", error);
        return res.status(500).send("Internal Server Error processing updates.");
    }
};