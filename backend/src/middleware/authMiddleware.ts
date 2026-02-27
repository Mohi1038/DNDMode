import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const TEMP_JWT_SECRET = process.env.TEMP_JWT_SECRET || 'temporary_secret_key_123';

export const authenticateTempToken = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }

    jwt.verify(token, TEMP_JWT_SECRET, (err, decoded) => {
        if (err) {
            res.status(403).json({ message: 'Invalid or expired token' });
            return;
        }

        const payload = decoded as any;
        if (payload.scope !== 'onboarding') {
            res.status(403).json({ message: 'Invalid token scope' });
            return;
        }

        (req as any).user = payload;
        next();
    });
};
