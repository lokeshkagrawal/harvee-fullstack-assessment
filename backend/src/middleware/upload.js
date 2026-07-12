const multer = require('multer');
const path = require('path');
const MAX_SIZE_MB = parseInt(process.env.MAX_UPLOAD_SIZE_MB || '10' ,10);

// Store in memory - we parse immediately and push to Postgres, no need to persist raw file
const storage = multer.memoryStorage();

function fileFilter(req,file,cb){
    const allowedExt = ['.csv','.xls','.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if(!allowedExt.includes(ext)){
        return cb(new Error('Only .csv, .xls, .xlsx files are allowed'));
    }
    cb(null, true); 
}

const upload = multer({
    storage,
    fileFilter, 
    limits:{fileSize: MAX_SIZE_MB * 1024 *1024},
});

module.exports = upload;
