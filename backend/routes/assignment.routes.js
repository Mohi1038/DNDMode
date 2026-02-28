const express = require('express');
const router = express.Router();
const AssignmentController = require('../controllers/assignment.controller');

// GET /api/v1/assignments/sync-and-breakdown
router.get('/sync-and-breakdown', AssignmentController.getSyncAndBreakdown);

module.exports = router;
