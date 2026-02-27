import { Router } from 'express';
import multer from 'multer';
import { uploadTimetable } from '../controllers/timetableController';

// Store files in memory buffer
const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.post('/upload', upload.single('timetable'), uploadTimetable);

export default router;
