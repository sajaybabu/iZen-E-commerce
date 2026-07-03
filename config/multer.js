const multer = require('multer');
const path = require('path');
const fs = require('fs');

// throw error if directory doesnt exist
const uploadDir = path.join(__dirname, '../public/uploads/profile');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/profile'); 
    },
    filename: (req, file, cb) => {
        //timestamp + original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

//checking both extension name and actual MIME type
const fileFilter = (req, file, cb) => {
    // allowed image extensions and formats
    const allowedFileTypes = /jpeg|jpg|png|webp/;
    
    // Validate file extension name
    const extName = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
    
    // Validate the file MIME type
    const mimeType = allowedFileTypes.test(file.mimetype);

    if (extName && mimeType) {
        return cb(null, true); 
    } else {
        //error message
        return cb(new Error('Invalid file configuration! Only JPEG, JPG, PNG, and WEBP images are allowed.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // Strict 5MB capacity cap
});

module.exports = upload;