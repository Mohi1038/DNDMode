import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

// TypeScript routes
import authRoutes from './routes/authRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import timetableRoutes from './routes/timetableRoutes';
import governanceRoutes from './routes/governanceRoutes';
import groupRoutes from './routes/groupRoutes';
import { findGroupByCode, setGroupBroadcaster } from './controllers/groupController';

// JavaScript routes (CommonJS) — imported via require
const notificationRoutes = require('../routes/notificationRoutes');
const sttRoutes = require('../routes/sttRoutes');
const agentRoutes = require('../routes/agentRoutes');
const audioRoutes = require('../routes/audioRoutes');
const digitalWellbeingRoutes = require('../routes/digitalWellbeingRoutes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const server = createServer(app);

const wsClientsByGroup = new Map<string, Set<WebSocket>>();

const sendWs = (socket: WebSocket, payload: any) => {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
    }
};

const broadcastGroupUpdate = (group: any) => {
    const clients = wsClientsByGroup.get(group.id);
    if (!clients || clients.size === 0) {
        return;
    }

    for (const client of clients) {
        sendWs(client, { type: 'group:update', group });
    }
};

setGroupBroadcaster(broadcastGroupUpdate);

const wss = new WebSocketServer({ server, path: '/ws/groups' });

wss.on('connection', (socket, req) => {
    const host = req.headers.host || `localhost:${PORT}`;
    const url = new URL(req.url || '/ws/groups', `http://${host}`);
    const groupId = url.searchParams.get('groupId');
    const userName = url.searchParams.get('userName') || 'unknown';

    if (!groupId) {
        sendWs(socket, { type: 'error', message: 'groupId is required' });
        socket.close();
        return;
    }

    if (!wsClientsByGroup.has(groupId)) {
        wsClientsByGroup.set(groupId, new Set<WebSocket>());
    }

    wsClientsByGroup.get(groupId)?.add(socket);
    console.log(`[WS] connected user=${userName} group=${groupId}`);

    sendWs(socket, { type: 'ws:connected', groupId });

    socket.on('close', () => {
        const set = wsClientsByGroup.get(groupId);
        if (!set) {
            return;
        }
        set.delete(socket);
        if (set.size === 0) {
            wsClientsByGroup.delete(groupId);
        }
        console.log(`[WS] disconnected user=${userName} group=${groupId}`);
    });
});

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

app.get('/join/:code', (req, res) => {
        const group = findGroupByCode(req.params.code || '');

        if (!group) {
                return res.status(404).send('<h2>Group not found</h2><p>The invite code is invalid or expired.</p>');
        }

        const deepLink = `dndmode://join/${group.code}`;
        const html = `<!doctype html>
<html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Join ${group.name}</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0f1115; color:#f8fafc; padding:24px; }
            .card { max-width:520px; margin:40px auto; padding:24px; border:1px solid #334155; border-radius:16px; background:#161b22; }
            .code { font-size:32px; letter-spacing:6px; color:#22d3ee; margin:12px 0; }
            .btn { display:inline-block; margin-top:12px; padding:10px 14px; border-radius:10px; background:#2563eb; color:white; text-decoration:none; }
            .sub { color:#94a3b8; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>Join group: ${group.name}</h2>
            <p class="sub">Use this code in DND Mode app:</p>
            <div class="code">${group.code}</div>
            <a class="btn" href="${deepLink}">Open in DND Mode</a>
        </div>
    </body>
</html>`;

        return res.status(200).send(html);
});

// 404 handler
app.use((req, res) => {
    console.warn(`[404 NOT FOUND] ${req.method} ${req.originalUrl}`);
    res.status(404).send(`Cannot ${req.method} ${req.originalUrl}`);
});

// Start
server.listen(Number(PORT), '0.0.0.0', () => {
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
    console.log(`   Join Link:     http://localhost:${PORT}/join/:code`);
    console.log(`   Groups WS:     ws://localhost:${PORT}/ws/groups?groupId=<id>&userName=<name>`);
    console.log(`\n   Waiting for data from Android device...\n`);
});
