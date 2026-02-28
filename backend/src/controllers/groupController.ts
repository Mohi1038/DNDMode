import { Request, Response } from 'express';

interface GroupMember {
    id: string;
    name: string;
    role: 'Admin' | 'Buddy';
    selectedApps?: string[];
}

interface GroupTimer {
    packageName: string;
    appName: string;
    durationMins: number; // 20m to 4h
}

interface Group {
    id: string;
    code: string;
    name: string;
    createdBy: string;
    members: GroupMember[];
    activeTimers: GroupTimer[];
    sessionStarted: boolean;
    startTime?: number;
}

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

export const createGroup = (req: Request, res: Response) => {
    const { name, userName } = req.body;

    if (!name || !userName) {
        return res.status(400).json({ error: 'Group name and user name are required' });
    }

    const id = Math.random().toString(36).substring(2, 9);
    const code = generateCode();

    const newGroup: Group = {
        id,
        code,
        name,
        createdBy: userName,
        members: [
            { id: userName + Date.now(), name: userName, role: 'Admin' },
            { id: 'buddy_alex', name: 'Alex', role: 'Buddy', selectedApps: ['com.instagram.android'] },
            { id: 'buddy_sam', name: 'Sam', role: 'Buddy', selectedApps: ['com.google.android.youtube'] }
        ],
        activeTimers: [],
        sessionStarted: false
    };

    groups.set(id, newGroup);
    res.status(201).json({
        groupId: id,
        groupCode: code,
        inviteLink: `dndmode://join/${code}`
    });
};

export const joinGroup = (req: Request, res: Response) => {
    const { code, userName } = req.body;

    if (!code || !userName) {
        return res.status(400).json({ error: 'Code and user name are required' });
    }

    const group = Array.from(groups.values()).find(g => g.code === code.toUpperCase());

    if (!group) {
        return res.status(404).json({ error: 'Group not found' });
    }

    if (group.members.some(m => m.name === userName)) {
        // Already in, just return success
        return res.json(group);
    }

    group.members.push({ id: userName + Date.now(), name: userName, role: 'Buddy' });
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

    res.json(group);
};

export const proposeApps = (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { userName, apps } = req.body;

    const group = groups.get(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const member = group.members.find(m => m.name === userName);
    if (!member) return res.status(404).json({ error: 'Member not found in group' });

    member.selectedApps = apps;
    res.json(group);
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

    res.json({ message: 'Focus session initiated for all members', group });
};
