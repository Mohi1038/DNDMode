import { Router } from 'express';
import { verifyInitial, signup } from '../controllers/authController';

const router = Router();

router.post('/verify-initial', verifyInitial);
router.post('/signup', signup);

export default router;
