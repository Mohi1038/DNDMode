const express = require("express");
const router = express.Router();
const controller = require("../controllers/notificationController");

// POST — ingest notification (store + forward to AI)
router.post("/ingest", controller.ingestNotification);

// GET — retrieve all stored notifications
router.get("/", controller.getAllNotifications);

// GET — retrieve latest notification
router.get("/latest", controller.getLatestNotification);

// DELETE — clear all stored notifications
router.delete("/", controller.clearAllNotifications);

module.exports = router;
