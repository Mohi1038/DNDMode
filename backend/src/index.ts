import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import timetableRoutes from './routes/timetableRoutes';
import governanceRoutes from './routes/governanceRoutes';
import groupRoutes from './routes/groupRoutes';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/groups', groupRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// 404 handler for debugging
app.use((req, res) => {
    console.warn(`[404 NOT FOUND] ${req.method} ${req.originalUrl}`);
    res.status(404).send(`Cannot ${req.method} ${req.originalUrl}`);
});
