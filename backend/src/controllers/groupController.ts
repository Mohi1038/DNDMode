import { Request, Response } from 'express';

interface GroupMember {
    id: string;
    name: string;
    role: 'Admin' | 'Buddy';
    totalMobileMins?: number;
    negativePoints?: number;
    selectedApps?: GroupSelectedApp[];
}

interface GroupSelectedApp {
    packageName: string;
    appName: string;
    durationMins: number;
}

interface GroupTimer {
    packageName: string;
    appName: string;
    durationMins: number; // 20m to 4h
}

interface Group {
    id: string;
    code: string;
    inviteLink: string;
    name: string;
    createdBy: string;
    members: GroupMember[];
    activeTimers: GroupTimer[];
    sessionStarted: boolean;
    startTime?: number;
    lastPenalty?: {
        offenderName: string;
        usedMins: number;
        lossPerOtherMins: number;
        at: number;
    };
}

let broadcastGroupUpdate: (group: Group) => void = () => {};

export const setGroupBroadcaster = (broadcaster: (group: Group) => void) => {
    broadcastGroupUpdate = broadcaster;
};

// In-memory store
const groups = new Map<string, Group>();

const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous chars
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

const getMemberTotalAllocatedMins = (member: GroupMember) => {
    return (member.selectedApps || []).reduce((sum, app) => sum + Math.max(0, Number(app.durationMins) || 0), 0);
};

const normalizeMemberAppsToTotal = (member: GroupMember) => {
    const totalMobileMins = Math.max(0, Number(member.totalMobileMins) || 0);
    if (!member.selectedApps || member.selectedApps.length === 0) return;

    let allocated = getMemberTotalAllocatedMins(member);
    if (allocated <= totalMobileMins) return;

    const sortedApps = [...member.selectedApps].sort((a, b) => (b.durationMins || 0) - (a.durationMins || 0));
    let overflow = allocated - totalMobileMins;

    for (const app of sortedApps) {
        if (overflow <= 0) break;
        const current = Math.max(0, Number(app.durationMins) || 0);
        const cut = Math.min(current, overflow);
        app.durationMins = current - cut;
        overflow -= cut;
    }

};

const buildInviteLink = (req: Request, code: string) => {
    const protocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 5000}`;
    return `${protocol}://${host}/join/${code}`;
};

export const findGroupByCode = (rawCode: string) => {
    const code = (rawCode || '').toUpperCase().trim();
    return Array.from(groups.values()).find(g => g.code === code);
};

export const createGroup = (req: Request, res: Response) => {
    const { name, userName } = req.body;

    if (!name || !userName) {
        return res.status(400).json({ error: 'Group name and user name are required' });
    }

    const id = Math.random().toString(36).substring(2, 9);
    const code = generateCode();
    const inviteLink = buildInviteLink(req, code);

    const newGroup: Group = {
        id,
        code,
        inviteLink,
        name,
        createdBy: userName,
        members: [
            { id: userName + Date.now(), name: userName, role: 'Admin', totalMobileMins: 120, negativePoints: 0 },
            {
                id: 'buddy_alex',
                name: 'Alex',
                role: 'Buddy',
                totalMobileMins: 120,
                negativePoints: 0,
                selectedApps: [{ packageName: 'com.instagram.android', appName: 'Instagram', durationMins: 10 }]
            },
            {
                id: 'buddy_sam',
                name: 'Sam',
                role: 'Buddy',
                totalMobileMins: 120,
                negativePoints: 0,
                selectedApps: [{ packageName: 'com.google.android.youtube', appName: 'YouTube', durationMins: 10 }]
            }
        ],
        activeTimers: [],
        sessionStarted: false
    };

    groups.set(id, newGroup);
    broadcastGroupUpdate(newGroup);

    res.status(201).json({
        groupId: id,
        groupCode: code,
        inviteLink
    });
};

export const joinGroup = (req: Request, res: Response) => {
    const { code, userName } = req.body;
    const normalizedUserName = String(userName || '').trim();

    if (!code || !normalizedUserName) {
        return res.status(400).json({ error: 'Code and user name are required' });
    }

    const group = findGroupByCode(code);

    if (!group) {
        return res.status(404).json({ error: 'Group not found' });
    }

    if (group.members.some(m => m.name.toLowerCase() === normalizedUserName.toLowerCase())) {
        // Already in, just return success
        return res.json(group);
    }

    group.members.push({ id: normalizedUserName + Date.now(), name: normalizedUserName, role: 'Buddy', totalMobileMins: 0, negativePoints: 0 });
    broadcastGroupUpdate(group);
    res.json(group);
};

export const setMemberTotalTime = (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { userName, totalMins } = req.body;

    const group = groups.get(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const normalizedUserName = String(userName || '').trim();
    const parsedTotalMins = Number(totalMins);

    if (!normalizedUserName) {
        return res.status(400).json({ error: 'userName is required' });
    }

    if (!Number.isFinite(parsedTotalMins) || parsedTotalMins <= 0) {
        return res.status(400).json({ error: 'totalMins must be greater than 0' });
    }

    let member = group.members.find(m => m.name.toLowerCase() === normalizedUserName.toLowerCase());
    if (!member) {
        member = {
            id: normalizedUserName + Date.now(),
            name: normalizedUserName,
            role: 'Buddy',
            totalMobileMins: Math.floor(parsedTotalMins),
            negativePoints: 0,
            selectedApps: []
        };
        group.members.push(member);
    } else {
        member.totalMobileMins = Math.floor(parsedTotalMins);
        member.negativePoints = Number(member.negativePoints) || 0;
    }

    normalizeMemberAppsToTotal(member);
    broadcastGroupUpdate(group);
    res.json(group);
};

export const getGroupStatus = (req: Request, res: Response) => {
    const id = req.params.id as string;
    const group = groups.get(id);

    if (!group) {
        return res.status(404).json({ error: 'Group not found' });
    }

    res.json(group);
};

export const updateGroupTimer = (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { packageName, appName, durationMins, userName } = req.body;

    const group = groups.get(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Authorization: Only admin can change timing
    if (group.createdBy !== userName) {
        return res.status(403).json({ error: 'Only the group creator (Admin) can modify session parameters.' });
    }

    if (durationMins < 20 || durationMins > 240) {
        return res.status(400).json({ error: 'Duration must be between 20m and 4h (240m)' });
    }

    const existingIndex = group.activeTimers.findIndex(t => t.packageName === packageName);
    if (existingIndex > -1) {
        group.activeTimers[existingIndex].durationMins = durationMins;
    } else {
        group.activeTimers.push({ packageName, appName, durationMins });
    }

    broadcastGroupUpdate(group);
    res.json(group);
};

export const proposeApps = (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { userName, apps } = req.body;
    const normalizedUserName = String(userName || '').trim();

    const group = groups.get(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (!normalizedUserName) {
        return res.status(400).json({ error: 'User name is required' });
    }

    let member = group.members.find(m => m.name.toLowerCase() === normalizedUserName.toLowerCase());
    if (!member) {
        member = { id: normalizedUserName + Date.now(), name: normalizedUserName, role: 'Buddy', totalMobileMins: 0, negativePoints: 0 };
        group.members.push(member);
    }

    if (!Array.isArray(apps)) {
        return res.status(400).json({ error: 'Apps must be an array' });
    }

    const normalizedApps: GroupSelectedApp[] = apps
        .map((app: any) => {
            if (typeof app === 'string') {
                return {
                    packageName: app,
                    appName: app.split('.').pop() || app,
                    durationMins: 10,
                };
            }

            const packageName = typeof app?.id === 'string' ? app.id : typeof app?.packageName === 'string' ? app.packageName : '';
            if (!packageName) return null;

            const parsedDuration = Number(app?.durationMins);
            const safeDuration = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 10;

            return {
                packageName,
                appName: typeof app?.name === 'string' && app.name.trim() ? app.name : (packageName.split('.').pop() || packageName),
                durationMins: safeDuration,
            };
        })
        .filter((app: GroupSelectedApp | null): app is GroupSelectedApp => Boolean(app));

    const memberTotalMobile = Math.max(0, Number(member.totalMobileMins) || 0);
    if (memberTotalMobile <= 0) {
        return res.status(400).json({ error: 'Set your total mobile time in group first before configuring apps.' });
    }

    const totalAllocation = normalizedApps.reduce((sum, app) => sum + (Number(app.durationMins) || 0), 0);
    if (totalAllocation > memberTotalMobile) {
        return res.status(400).json({
            error: `Allocated app time (${totalAllocation}m) exceeds your total mobile time (${memberTotalMobile}m).`
        });
    }

    member.selectedApps = normalizedApps;
    broadcastGroupUpdate(group);
    res.json(group);
};

const getMemberTotalMins = (member: GroupMember) => {
    return (member.selectedApps || []).reduce((sum, app) => sum + Math.max(0, Number(app.durationMins) || 0), 0);
};

const reduceMemberTotalMins = (member: GroupMember, lossMins: number) => {
    if (!member.selectedApps || member.selectedApps.length === 0) return;

    let remainingLoss = Math.max(0, Math.floor(lossMins));
    if (remainingLoss <= 0) return;

    const appsByDuration = [...member.selectedApps].sort((a, b) => (b.durationMins || 0) - (a.durationMins || 0));

    for (const app of appsByDuration) {
        if (remainingLoss <= 0) break;
        const current = Math.max(0, Number(app.durationMins) || 0);
        const cut = Math.min(current, remainingLoss);
        app.durationMins = current - cut;
        remainingLoss -= cut;
    }
};

export const applyGroupPenalty = (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { offenderName, usedMins } = req.body;

    const group = groups.get(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const normalizedOffender = String(offenderName || '').trim();
    const parsedUsedMins = Number(usedMins);

    if (!normalizedOffender) {
        return res.status(400).json({ error: 'offenderName is required' });
    }

    if (!Number.isFinite(parsedUsedMins) || parsedUsedMins <= 0) {
        return res.status(400).json({ error: 'usedMins must be greater than 0' });
    }

    const offender = group.members.find(m => m.name.toLowerCase() === normalizedOffender.toLowerCase());
    if (!offender) {
        return res.status(404).json({ error: 'Offender is not a member of this group' });
    }

    const offenderTotal = Math.max(1, getMemberTotalMins(offender));
    const overflowRatio = parsedUsedMins / offenderTotal;

    const otherMembers = group.members.filter(m => m.name.toLowerCase() !== normalizedOffender.toLowerCase());
    for (const member of otherMembers) {
        const memberTotal = getMemberTotalMins(member);
        if (memberTotal <= 0) continue;

        const calculatedLoss = Math.ceil(memberTotal * overflowRatio * 0.3); // lighter impact
        const boundedLoss = Math.max(1, Math.min(calculatedLoss, 12));
        reduceMemberTotalMins(member, boundedLoss);
    }

    const lossPerOtherMins = otherMembers.length > 0
        ? Math.max(1, Math.min(Math.ceil((parsedUsedMins / Math.max(1, offenderTotal)) * 100 * 0.3), 12))
        : 0;

    group.lastPenalty = {
        offenderName: offender.name,
        usedMins: parsedUsedMins,
        lossPerOtherMins,
        at: Date.now(),
    };

    broadcastGroupUpdate(group);
    return res.json(group);
};

export const reportUsageEvent = (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { userName, appPackageName, usedMins } = req.body;

    const group = groups.get(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const normalizedUserName = String(userName || '').trim();
    const parsedUsedMins = Number(usedMins);

    if (!normalizedUserName) {
        return res.status(400).json({ error: 'userName is required' });
    }

    if (!Number.isFinite(parsedUsedMins) || parsedUsedMins <= 0) {
        return res.status(400).json({ error: 'usedMins must be greater than 0' });
    }

    const offender = group.members.find(m => m.name.toLowerCase() === normalizedUserName.toLowerCase());
    if (!offender) {
        return res.status(404).json({ error: 'User is not a member of this group' });
    }

    const offenderCurrentTotal = Math.max(0, Number(offender.totalMobileMins) || 0);
    const offenderWeight = Math.max(0.9, Math.min(offenderCurrentTotal / 180, 1.6));
    const offenderTimeLoss = Math.max(1, Math.ceil(parsedUsedMins * offenderWeight));

    offender.totalMobileMins = Math.max(0, offenderCurrentTotal - offenderTimeLoss);
    offender.negativePoints = (Number(offender.negativePoints) || 0) + Math.max(1, Math.ceil(offenderTimeLoss / 4));
    normalizeMemberAppsToTotal(offender);

    const others = group.members.filter(m => m.name.toLowerCase() !== normalizedUserName.toLowerCase());
    const offenderBaseTotal = Math.max(1, offenderCurrentTotal);
    const othersLosses: number[] = [];

    for (const member of others) {
        const currentTotal = Math.max(0, Number(member.totalMobileMins) || 0);
        if (currentTotal <= 0) {
            continue;
        }

        const memberTimeWeight = Math.max(0.35, Math.min(currentTotal / 180, 1.3));
        const otherTimeLoss = Math.max(1, Math.min(Math.ceil(parsedUsedMins * 0.35 * memberTimeWeight), 20));
        member.totalMobileMins = Math.max(0, currentTotal - otherTimeLoss);
        othersLosses.push(otherTimeLoss);

        const usageRatio = parsedUsedMins / offenderBaseTotal;
        const scaledPoints = Math.ceil(usageRatio * memberTimeWeight * 5);
        const otherPenaltyPoints = Math.max(0, Math.min(scaledPoints, 3));

        member.negativePoints = (Number(member.negativePoints) || 0) + otherPenaltyPoints;
        normalizeMemberAppsToTotal(member);
    }

    const averageOtherLoss = othersLosses.length > 0
        ? Math.ceil(othersLosses.reduce((sum, value) => sum + value, 0) / othersLosses.length)
        : 0;

    group.lastPenalty = {
        offenderName: offender.name,
        usedMins: parsedUsedMins,
        lossPerOtherMins: averageOtherLoss,
        at: Date.now(),
    };

    broadcastGroupUpdate(group);
    return res.json({
        group,
        meta: {
            offender: offender.name,
            appPackageName: appPackageName || null,
            offenderLossMins: offenderTimeLoss,
            othersLossMins: averageOtherLoss,
        }
    });
};

export const startFocusSession = (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { userName } = req.body;

    const group = groups.get(id);

    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Authorization: Only admin can start focus
    if (group.createdBy !== userName) {
        return res.status(403).json({ error: 'Only the group creator (Admin) can initiate focus.' });
    }

    group.sessionStarted = true;
    group.startTime = Date.now();

    broadcastGroupUpdate(group);

    res.json({ message: 'Focus session initiated for all members', group });
};
