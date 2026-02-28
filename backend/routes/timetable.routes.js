const express = require('express');
const router = express.Router();
const TimetableMergeController = require('../controllers/timetable.merge.controller');

// POST /api/v1/timetable/generate
router.post('/generate', TimetableMergeController.generateTimetable);

module.exports = router;
