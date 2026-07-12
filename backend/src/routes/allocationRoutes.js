const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const courseController = require('../controllers/courseController');
const allocationController = require('../controllers/allocationController');

// Student Registration
router.post('/students', studentController.registerStudent);
router.get('/students', studentController.listStudents);


//Course Management
router.post('/courses', courseController.createCourse);
router.get('/courses', courseController.listCourses);

//Allocation  Processing
router.post('/allocation/process',allocationController.processAllocation);
router.get('/allocation/results',allocationController.getResult);
router.get('/allocation/dashboard',allocationController.getDashboard);


// AI Assistant (reporting/analysis Q&A)
router.post('/allocation/ask', allocationController.askAssistant);

module.exports = router;
