import { Router } from 'express';
import {
    createGroup,
    joinGroup,
    getGroupStatus,
    updateGroupTimer,
    startFocusSession,
    proposeApps,
    applyGroupPenalty,
    setMemberTotalTime,
    reportUsageEvent
} from '../controllers/groupController';

const router = Router();

router.post('/create', createGroup);
router.post('/join', joinGroup);
router.get('/:id', getGroupStatus);
router.post('/:id/timer', updateGroupTimer);
router.post('/:id/propose-apps', proposeApps);
router.post('/:id/penalty', applyGroupPenalty);
router.post('/:id/total-time', setMemberTotalTime);
router.post('/:id/usage-event', reportUsageEvent);
router.post('/:id/start', startFocusSession);

export default router;
