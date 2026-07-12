const datasetService = require('../services/datasetService');
const aiSqlService = require('../services/aiSqlService');

async function uploadDataset(req, res){
    if(!req.file){
        return res.status(400).json({error: 'No file uploaded. Field name must be  "file".'});
    }

    const datasetLabel = req.body.datasetName || req.file.originalname.split('.')[0];

    const result = await datasetService.ingestDataset(req.file.buffer, req.file.originalname, datasetLabel);

    res.status(201).json({message:'Dataset Uploaded and table created successfully',
        dataset:result,
    });
}


async function listDatasets(req, res){
    const datasets = await datasetService.listDatasets();
    res.json({datasets});
}

async function getDatasets(req, res){
    const dataset = await datasetService.getDatasetById(req.params.id);
    if(!dataset) return res.status(404).json({error: 'Dataset not found'});
    res.json({dataset});
}


async function askQuestion(req, res) {
    const { question } = req.body;
    if (!question || !question.trim()) {
        return res.status(400).json({ error: 'question field is required' });
    }
    try {
        const result = await aiSqlService.askDataset(req.params.id, question);
        res.json(result);
    }
    catch (err) {
        if (err.isQuotaError) {
            return res.status(429).json({ message: 'AI quota exhausted. Please try again later.' });
        }
        if (err.isValidationError) {
            return res.status(422).json({ error: err.message, type: 'validation_error' });
        }
        if (err.isExecutionError) {
            return res.status(400).json({ error: err.message, type: 'execution_error' });
        }
        throw err;
    }
}

async function getHistory(req, res){
    const history = await aiSqlService.getQueryHistorty(req.params.id);
    res.json({history});
}

module.exports = {uploadDataset, listDatasets, getDatasets, askQuestion, getHistory};