require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { requestLogger } = require("./middleware/logger");
const notificationRoutes = require("./routes/notificationRoutes");
const sttRoutes = require("./routes/sttRoutes");
const agentRoutes = require("./routes/agentRoutes");
const audioRoutes = require("./routes/audioRoutes");
const digitalWellbeingRoutes = require("./routes/digitalWellbeingRoutes");
const assignmentRoutes = require("./routes/assignment.routes");
const newTimetableRoutes = require("./routes/timetable.routes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Routes
app.use("/api/notifications", notificationRoutes);
app.use("/api/stt", sttRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/audio", audioRoutes);
app.use("/api/digital-wellbeing", digitalWellbeingRoutes);
app.use("/api/v1/assignments", assignmentRoutes);
app.use("/api/v1/timetable", newTimetableRoutes);

// Alias: /notifications/ingest → same as /api/notifications/ingest
app.use("/notifications", notificationRoutes);

app.get("/api/test", (req, res) => {
    res.json({ message: "Backend working", name: "Divyansh" });
});

// Start server
const PORT = process.env.PORT || 5000;
const AI_HOST = process.env.AI_SERVER_HOST || "not set";
const AI_PORT = process.env.AI_SERVER_PORT || "not set";

app.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`   AI Server:     http://${AI_HOST}:${AI_PORT}`);
    console.log(`   Notifications: http://172.31.44.35:${PORT}/api/notifications`);
    console.log(`   Ingest:        http://172.31.44.35:${PORT}/api/notifications/ingest`);
    console.log(`   STT:           http://172.31.44.35:${PORT}/api/stt`);
    console.log(`   Agent Query:   http://172.31.44.35:${PORT}/api/agent/query`);
    console.log(`   Audio:         http://172.31.44.35:${PORT}/api/audio/:file`);
    console.log(`   Wellbeing:     http://172.31.44.35:${PORT}/api/digital-wellbeing/ingest`);
    console.log(`\n   Waiting for data from Android device...\n`);
});