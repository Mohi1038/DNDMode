import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'permanent_secret_key_456';

export const completeOnboarding = (req: Request, res: Response) => {
    console.log('--- ONBOARDING COMPLETION REQUEST ---');
    console.log(JSON.stringify(req.body, null, 2));

    const { personality, long_term_goals, short_term_goals } = req.body;
    const answers = personality?.answers;

    if (!answers) {
        return res.status(400).json({ message: 'Neural personality answers are missing from payload.' });
    }

    const requiredKeys = ['q1_attention', 'q2_decision', 'q3_emotion', 'q4_social', 'q5_discipline'];
    const missing = requiredKeys.filter(k => answers[k] === null || answers[k] === undefined);

    if (missing.length > 0) {
        return res.status(400).json({
            message: `Neural synchronization failed: Missing responses for ${missing.join(', ')}.`,
            missingFields: missing
        });
    }

    if (!Array.isArray(long_term_goals) || !Array.isArray(short_term_goals)) {
        return res.status(400).json({ message: 'Neural mission objectives (goals) are missing or improperly formatted.' });
    }

    // Scoring Logic based on the Architecture Doc
    let plannerScore = 0;
    let explorerScore = 0;
    let reactorScore = 0;
    let perfectionistScore = 0;

    // Q1 (Attention)
    if (answers.q1_attention === 0) perfectionistScore++;
    if (answers.q1_attention === 1) plannerScore++;
    if (answers.q1_attention === 2) reactorScore++;
    if (answers.q1_attention === 3) explorerScore++;

    // Q2 (Decision)
    if (answers.q2_decision === 0) explorerScore++;
    if (answers.q2_decision === 1) plannerScore++;
    if (answers.q2_decision === 2) reactorScore++;
    if (answers.q2_decision === 3) perfectionistScore++;

    // Q3 (Emotion)
    if (answers.q3_emotion === 0) perfectionistScore++;
    if (answers.q3_emotion === 1) plannerScore++;
    if (answers.q3_emotion === 2) explorerScore++;
    if (answers.q3_emotion === 3) plannerScore++; // analytical

    // Q4 (Social)
    if (answers.q4_social === 0) reactorScore++;
    if (answers.q4_social === 1) plannerScore++;
    if (answers.q4_social === 2) perfectionistScore++;
    if (answers.q4_social === 3) explorerScore++;

    // Q5 (Discipline)
    if (answers.q5_discipline === 0) perfectionistScore++;
    if (answers.q5_discipline === 1) plannerScore++;
    if (answers.q5_discipline === 2) reactorScore++;
    if (answers.q5_discipline === 3) explorerScore++;

    // Determine highest score
    const scores = [
        { name: 'The Focused Planner', score: plannerScore },
        { name: 'The Intuitive Explorer', score: explorerScore },
        { name: 'The Social Reactor', score: reactorScore },
        { name: 'The Perfectionist', score: perfectionistScore },
    ];

    scores.sort((a, b) => b.score - a.score);
    const archetype = scores[0].name;

    // Extract user from body (no JWT for now)
    const userId = req.body.user_id || 'unknown_user';

    // Create permanent full access token
    const accessTokenPayload = {
        email: userId,
        archetype,
        scope: 'full_access'
    };

    const accessToken = jwt.sign(accessTokenPayload, JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
        message: 'Onboarding complete',
        archetype,
        accessToken,
    });
};
