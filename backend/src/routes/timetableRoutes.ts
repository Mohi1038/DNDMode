import { Router } from 'express';
import multer from 'multer';
import { uploadTimetable } from '../controllers/timetableController';

// Store files in memory buffer
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 8 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (!file.mimetype?.startsWith('image/')) {
			cb(new Error('Only image files are allowed.'));
			return;
		}
		cb(null, true);
	},
});

const router = Router();

router.post('/upload', upload.single('timetable'), uploadTimetable);

export default router;
