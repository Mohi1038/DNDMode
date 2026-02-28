const express = require("express");
const router = express.Router();
const { receiveSpeech } = require("../controllers/sttController");

// POST — receive speech-to-text from Android device
router.post("/", receiveSpeech);

module.exports = router;
