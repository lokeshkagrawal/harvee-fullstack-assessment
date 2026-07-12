const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const controller = require('../controllers/datasetController');

// Task 2: AI SQL Assistant endpoints
router.post('/upload', upload.single('file'), controller.uploadDataset);
router.get('/', controller.listDatasets);
router.get('/:id', controller.getDatasets);
router.post('/:id/ask', controller.askQuestion);
router.get('/:id/history', controller.getHistory);

module.exports = router;