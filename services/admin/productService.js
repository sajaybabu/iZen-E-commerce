const Product = require('../../models/Product');
const Category = require('../../models/categoryModel');

const createProduct = async (body, files) => {
    const { name, description, category, discount, variantsDataJSON, isFeatured } = body;

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

        const variantImages = files
            ? files
                  .filter(file => file.fieldname === targetKeyName)
                  .map(file => `/uploads/products/${file.filename}`)
            : [];

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
        isFeatured:
            isFeatured === 'on' ||
            isFeatured === true ||
            isFeatured === 'true'
    });

    return await newProduct.save();
};

const getAllProducts = async () => {
    return await Product.find({
        isDeleted: { $ne: true }
    }).sort({ createdAt: -1 });
};

const getCategoriesForAddPage = async () => {
    return await Category.find({
        isListed: true,
        isDeleted: { $ne: true }
    });
};

const deleteProduct = async (id) => {
    return await Product.findByIdAndUpdate(
        id,
        { isDeleted: true },
        { returnDocument: 'after' }
    );
};

const searchProducts = async (name) => {
    return await Product.find({
        name: {
            $regex: name.trim(),
            $options: 'i'
        },
        isDeleted: { $ne: true }
    }).sort({ createdAt: -1 });
};

const getProductById = async (id) => {
    return await Product.findById(id);
};

const updateProduct = async (id, body, files) => {

    const {
        name,
        description,
        category,
        discount,
        variantsDataJSON,
        removedImagesJSON
    } = body;

    const product = await Product.findOne({
        _id: id,
        isDeleted: { $ne: true }
    });

    if (!product) {
        throw new Error("Product not found");
    }

    let imageRemovalList = [];

    if (removedImagesJSON) {
        try {
            imageRemovalList = JSON.parse(removedImagesJSON);
        } catch (err) {
            console.error(err);
        }
    }

    product.name = name;
    product.description = description;
    product.category = category;
    product.discount = parseInt(discount, 10) || 0;

    const submittedVariants = JSON.parse(variantsDataJSON);

    const finalVariants = [];
    let globalImagesArray = [];

    let totalQuantity = 0;
    let startingPrice = Infinity;

    for (let i = 0; i < submittedVariants.length; i++) {

        const incomingVariant = submittedVariants[i];

        let allocatedImages =
            product.variants && product.variants[i]
                ? product.variants[i].images
                : [];

        allocatedImages = allocatedImages.filter(
            img => !imageRemovalList.includes(img)
        );

        if (files && files.length > 0) {

            const targetKeyName = `variantImages_${i}`;

            const freshlyUploaded = files
                .filter(file => file.fieldname === targetKeyName)
                .map(file => `/uploads/products/${file.filename}`);

            allocatedImages =
                allocatedImages.concat(freshlyUploaded);
        }

        const vQty =
            parseInt(incomingVariant.quantity, 10) || 0;

        const vPrice =
            parseFloat(incomingVariant.price) || 0;

        totalQuantity += vQty;

        if (vPrice < startingPrice) {
            startingPrice = vPrice;
        }

        globalImagesArray =
            globalImagesArray.concat(allocatedImages);

        finalVariants.push({
            attributes: incomingVariant.attributes || {},
            quantity: vQty,
            price: vPrice,
            images: allocatedImages
        });
    }

    if (startingPrice === Infinity) {
        startingPrice = 0;
    }

    product.variants = finalVariants;
    product.images = globalImagesArray;
    product.price = startingPrice;
    product.stock = totalQuantity;

    product.markModified('variants');
    product.markModified('images');

    return await product.save();
};

module.exports = {
    createProduct,
    getAllProducts,
    getCategoriesForAddPage,
    deleteProduct,
    searchProducts,
    getProductById,
    updateProduct
};