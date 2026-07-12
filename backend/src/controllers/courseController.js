const courseService = require('../services/courseService');


async function createCourse(req,res){
    const result = await courseService.createCourse(req.body);
    res.status(201).json({message: 'Course created successfully', ...result});
}

async function listCourses(req,res){
    const courses = await courseService.listCourses();
    res.json({courses});
}

module.exports = {createCourse, listCourses};