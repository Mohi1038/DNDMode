const express = require("express");
const path = require("path");
const router = express.Router();

// GET — serve saved WAV files
router.get("/:filename", (req, res) => {
    const { filename } = req.params;

    // Security: only allow .wav files, no path traversal
    if (!filename.endsWith(".wav") || filename.includes("..")) {
        return res.status(400).json({ status: "error", message: "Invalid filename" });
    }

    const filePath = path.join(__dirname, "..", "temp", filename);

    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`   ❌ Audio file not found: ${filename}`);
            res.status(404).json({ status: "error", message: "Audio not found" });
        }
    });
});

module.exports = router;
