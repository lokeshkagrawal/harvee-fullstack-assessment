const studentService = require('../services/studentService');


async function registerStudent(req, res){
    const result = await studentService.registerStudent(req.body);
    res.status(201).json({message: 'Student registered successfully', ...result});
}

async function listStudents(req, res){
    const students= await studentService.listStudents();
    res.json({students});    
}

module.exports = {registerStudent, listStudents};