import { Router } from 'express';
import { verifyInitial } from '../controllers/authController';

const router = Router();

router.post('/verify-initial', verifyInitial);

export default router;
