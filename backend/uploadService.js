const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const path = require('path');
const fs = require('fs');

// ─── CLOUDINARY CONFIG ──────────────────────────────────
const isCloudinaryConfigured = !!(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME);

if (!isCloudinaryConfigured) {
    console.warn("☁️ Cloudinary credentials not found. Falling back to local/uploads folder.");
} else {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log("☁️ Cloudinary configured for cloud uploads.");
}

// ─── FILE VALIDATION ────────────────────────────────────
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5 MB
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;  // 25 MB

const fileFilter = (req, file, cb) => {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
        return cb(new Error(`File type '${file.mimetype}' not allowed. Accepted: images (jpg, png, webp, gif) and videos (mp4, webm).`), false);
    }
    cb(null, true);
};

// ─── STORAGE CONFIG ─────────────────────────────────────
const storage = isCloudinaryConfigured ? multer.memoryStorage() : multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
        const ext = path.extname(file.originalname);
        cb(null, uniqueSuffix + ext.replace(/\s+/g, '_'));
    }
});

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_VIDEO_SIZE // multer enforces max; we check image vs video below
    }
});

// ─── CLOUDINARY UPLOAD WITH OPTIMIZATION ─────────────────
const uploadToCloudinary = (buffer, mimetype) => {
    return new Promise((resolve, reject) => {
        const isVideo = ALLOWED_VIDEO_TYPES.includes(mimetype);
        const resourceType = isVideo ? 'video' : 'image';

        const options = {
            folder: 'zipzapzoi_media',
            resource_type: resourceType,
        };

        // Auto-optimize images via Cloudinary transformations
        if (!isVideo) {
            options.transformation = [
                { quality: 'auto', fetch_format: 'auto' },  // auto WebP/AVIF + quality
                { width: 1200, crop: 'limit' }               // max 1200px width
            ];
        }

        let stream = cloudinary.uploader.upload_stream(
            options,
            (error, result) => {
                if (result) {
                    resolve(result);
                } else {
                    reject(error);
                }
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
};

// ─── UPLOAD HANDLER ─────────────────────────────────────
const handleUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded. Please use 'media' key in form-data." });
        }

        const isVideo = ALLOWED_VIDEO_TYPES.includes(req.file.mimetype);
        const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;

        // Enforce image-specific size limit (multer only enforces the global max)
        if (req.file.size > maxSize) {
            return res.status(413).json({
                error: `File too large. Max ${isVideo ? '25MB for videos' : '5MB for images'}.`,
                maxBytes: maxSize,
                actualBytes: req.file.size
            });
        }

        if (isCloudinaryConfigured) {
            const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
            return res.json({
                success: true,
                url: result.secure_url,
                public_id: result.public_id,
                width: result.width,
                height: result.height,
                format: result.format,
                bytes: result.bytes,
                provider: 'cloudinary'
            });
        }

        // Local fallback
        const baseUrl = process.env.NODE_ENV === 'production' ? '' : `http://localhost:${process.env.PORT || 5000}`;
        const localUrl = `${baseUrl}/uploads/${req.file.filename}`;
        return res.json({
            success: true,
            url: localUrl,
            filename: req.file.filename,
            bytes: req.file.size,
            provider: 'local'
        });

    } catch (error) {
        console.error("Upload error:", error);
        if (error.message && error.message.includes('File type')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
};

// ─── PROVIDER INFO ──────────────────────────────────────
const getProvider = () => ({
    provider: isCloudinaryConfigured ? 'cloudinary' : 'local',
    maxImageSize: MAX_IMAGE_SIZE,
    maxVideoSize: MAX_VIDEO_SIZE,
    allowedTypes: ALLOWED_TYPES
});

module.exports = {
    uploadMiddleware: upload.single('media'),
    handleUpload,
    getProvider,
    isCloudinaryConfigured
};
