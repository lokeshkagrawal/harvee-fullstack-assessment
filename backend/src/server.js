require('dotenv').config();
require('express-async-errors');

const express = require('express');
const cors = require('cors');
const helmet  = require('helmet')
const rateLimit = require('express-rate-limit');

const datasetRoutes = require('./routes/datasetRoutes');
const allocationRoutes = require('./routes/allocationRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json({limit :'2mb'}));
app.use(express.urlencoded({extended : true}));


// Basic rate limiting, especially important for AI-calling endpoints
const limiter = rateLimit({
    windowMs:60 * 1000,
    max:60,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', limiter);
app.get('/health', (req,res)=>res.json({status:'ok', timestamp:new Date().toISOString()}));


// Task 1: Student Course Allocation System
app.use('/api', allocationRoutes);

//  Task 2: AI SQL Assistant
app.use('/api/datasets', datasetRoutes);

app.use((req, res) => res.status(404).json({error: 'Route not found'}));
app.use(errorHandler);

app.listen(PORT, ()=>{
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
