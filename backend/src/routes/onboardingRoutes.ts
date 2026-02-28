import { Router } from 'express';
import { completeOnboarding } from '../controllers/onboardingController';

const router = Router();

// Open route — no JWT required yet
router.post('/complete', completeOnboarding);

export default router;
