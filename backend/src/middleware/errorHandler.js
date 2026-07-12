//Error Handling & Server Entry Point

function errorHandler(err, req, res, next){
    console.error(err);

    if(err.isValidationError){
        return res.status(400).json({error : err.message});
    }

     if(err.isQuotaError){
        return res.status(429).json({error : err.message});
    }

    if(err.code === '23505')
    {//Postgres Unique Violation
        return res.status(409).json({error : 'Duplicate Entry', detail:err.detail})
    }

    if(err.code === '23503')
    {//Postgres foreign key violation
        return res.status(409).json({error : 'Invalid reference (foreign key)', detail:err.detail})
    }

    if(err.name === 'MulterError'){
        return res.status(400).json({error: err.message});
    }

    res.status(err.status || 500). json({error:err.message || 'Internal Server Error'});
}

module.exports = errorHandler;