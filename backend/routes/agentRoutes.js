const express = require("express");
const router = express.Router();
const { handleQuery } = require("../controllers/agentController");

// POST — send speech query to AI agent, receive audio URL
router.post("/query", handleQuery);

module.exports = router;
