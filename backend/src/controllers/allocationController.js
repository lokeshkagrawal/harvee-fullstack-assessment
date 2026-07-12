const allocationService = require('../services/allocationService');

const aiAssistant = require('../services/allocationAiAssistant');

async function processAllocation(req,res){
    const summary = await allocationService.runAllocation()
    res.json({message:'Allocation processed successfully', summary});
}

async function getResult(req,res){
    const results = await allocationService.getAllocationResults();
    res.json({results});
}

async function getDashboard(req,res){
    const stats = await allocationService.getDashboardStats();
    res.json(stats);
}

async function askAssistant(req,res){
    const {question} = req.body;
    if(!question || !question.trim()){
        return res.status(400).json({error: 'question field is required'});
    }
    try {
            const result = await aiAssistant.askAllocationAssistant(question);
            res.json(result);
    } catch (error) {
        if (error.isQuotaError) return res.status(429).json({ message: 'AI quota exhausted. Please try again later.' });
        if(error.isValidationError) return res.status(422).json({error : error.message});
        if(error.isExecutionError) return res.status(400).json({error : error.message});
        throw error;
    }
}

module.exports = {getDashboard, getResult, processAllocation, askAssistant};