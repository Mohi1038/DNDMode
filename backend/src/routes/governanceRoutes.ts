import { Router } from 'express';

const router = Router();

/**
 * GET /api/governance/apps
 * Returns the list of supported applications with their branding and default windows.
 */
router.get('/apps', (req, res) => {
    const apps = [
        { id: '1', name: 'Instagram', icon: '📸', start: '18:00', end: '20:00', color: '#E1306C' },
        { id: '2', name: 'YouTube', icon: '📺', start: '20:00', end: '22:00', color: '#FF0000' },
        { id: '3', name: 'Netflix', icon: '🎬', start: '21:00', end: '23:00', color: '#E50914' },
        { id: '4', name: 'WhatsApp', icon: '💬', start: '09:00', end: '21:00', color: '#25D366' },
        { id: '5', name: 'Twitter', icon: '🐦', start: '12:00', end: '14:00', color: '#1DA1F2' },
        { id: '6', name: 'Discord', icon: '🤖', start: '16:00', end: '23:00', color: '#5865F2' },
    ];

    res.json({
        success: true,
        apps
    });
});

export default router;
