import { Router } from 'express';
import { completeOnboarding } from '../controllers/onboardingController';
import { authenticateTempToken } from '../middleware/authMiddleware';

const router = Router();

// Apply middleware to protect the route
router.post('/complete', authenticateTempToken, completeOnboarding);

export default router;
