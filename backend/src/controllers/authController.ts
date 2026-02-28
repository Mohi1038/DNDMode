import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

// In a real app, this would come from process.env.TEMP_JWT_SECRET
const TEMP_JWT_SECRET = process.env.TEMP_JWT_SECRET || 'temporary_secret_key_123';

export const verifyInitial = (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    // TODO: Validate user against database (check if user exists and password matches)
    // For the sake of the onboarding demo, we assume the user is valid or being created

    const tempTokenPayload = {
        email,
        scope: 'onboarding', // Restricted scope
    };

    // Give a short-lived token (e.g., 30m)
    const tempToken = jwt.sign(tempTokenPayload, TEMP_JWT_SECRET, { expiresIn: '30m' });

    return res.status(200).json({
        message: 'Initial verification successful. Proceed to onboarding.',
        tempToken,
    });
};

export const signup = (req: Request, res: Response) => {
    const { name, email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    // TODO: In a real app, create user in database
    const tempTokenPayload = {
        email,
        name: name || email.split('@')[0],
        scope: 'onboarding',
    };

    const tempToken = jwt.sign(tempTokenPayload, TEMP_JWT_SECRET, { expiresIn: '30m' });

    return res.status(201).json({
        message: 'Account created successfully. Proceed to onboarding.',
        tempToken,
    });
};
