require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { requestLogger } = require("./middleware/logger");
const notificationRoutes = require("./routes/notificationRoutes");
const sttRoutes = require("./routes/sttRoutes");
const agentRoutes = require("./routes/agentRoutes");
const audioRoutes = require("./routes/audioRoutes");
const digitalWellbeingRoutes = require("./routes/digitalWellbeingRoutes");

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
    console.log(`   Notifications: http://localhost:${PORT}/api/notifications`);
    console.log(`   Ingest:        http://localhost:${PORT}/api/notifications/ingest`);
    console.log(`   STT:           http://localhost:${PORT}/api/stt`);
    console.log(`   Agent Query:   http://localhost:${PORT}/api/agent/query`);
    console.log(`   Audio:         http://localhost:${PORT}/api/audio/:file`);
    console.log(`   Wellbeing:     http://localhost:${PORT}/api/digital-wellbeing/ingest`);
    console.log(`\n   Waiting for data from Android device...\n`);
});