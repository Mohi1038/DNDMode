import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// TypeScript routes
import authRoutes from './routes/authRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import timetableRoutes from './routes/timetableRoutes';
import governanceRoutes from './routes/governanceRoutes';
import groupRoutes from './routes/groupRoutes';

// JavaScript routes (CommonJS) — imported via require
const notificationRoutes = require('../routes/notificationRoutes');
const sttRoutes = require('../routes/sttRoutes');
const agentRoutes = require('../routes/agentRoutes');
const audioRoutes = require('../routes/audioRoutes');
const digitalWellbeingRoutes = require('../routes/digitalWellbeingRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// ── TypeScript routes (auth, onboarding, timetable, governance, groups) ──
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/groups', groupRoutes);

// ── JavaScript routes (notifications, STT, agent, audio, wellbeing) ──
app.use('/api/notifications', notificationRoutes);
app.use('/api/stt', sttRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/digital-wellbeing', digitalWellbeingRoutes);

// Alias: /notifications/ingest → same as /api/notifications/ingest
app.use('/notifications', notificationRoutes);

// Health / test
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

app.get('/api/test', (_req, res) => {
    res.json({ message: 'Backend working', name: 'Divyansh' });
});

// 404 handler
app.use((req, res) => {
    console.warn(`[404 NOT FOUND] ${req.method} ${req.originalUrl}`);
    res.status(404).send(`Cannot ${req.method} ${req.originalUrl}`);
});

// Start
app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`   Timetable AI:  Gemini`);
    console.log(`   Auth:          http://localhost:${PORT}/api/auth`);
    console.log(`   Onboarding:    http://localhost:${PORT}/api/onboarding`);
    console.log(`   Timetable:     http://localhost:${PORT}/api/timetable`);
    console.log(`   Governance:    http://localhost:${PORT}/api/governance`);
    console.log(`   Groups:        http://localhost:${PORT}/api/groups`);
    console.log(`   Notifications: http://localhost:${PORT}/api/notifications`);
    console.log(`   Ingest:        http://localhost:${PORT}/api/notifications/ingest`);
    console.log(`   STT:           http://localhost:${PORT}/api/stt`);
    console.log(`   Agent Query:   http://localhost:${PORT}/api/agent/query`);
    console.log(`   Audio:         http://localhost:${PORT}/api/audio/:file`);
    console.log(`   Wellbeing:     http://localhost:${PORT}/api/digital-wellbeing/ingest`);
    console.log(`\n   Waiting for data from Android device...\n`);
});
