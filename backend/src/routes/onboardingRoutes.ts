import { Router } from 'express';
import { completeOnboarding } from '../controllers/onboardingController';
// import { authenticateTempToken } from '../middleware/authMiddleware';

const router = Router();

// Temporarily bypassed auth for debugging
router.post('/complete', (req, res, next) => {
    console.log('📋 Onboarding /complete hit, body:', JSON.stringify(req.body));
    // Fake user for now since auth is bypassed
    (req as any).user = { email: 'test@example.com' };
    next();
}, completeOnboarding);

export default router;
