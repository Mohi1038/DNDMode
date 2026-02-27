import { create } from 'zustand';

interface OnboardingState {
    // Step 1: Login Data
    tempJwt: string | null;
    userEmail: string | null;

    // Step 2: Behavioral Answers (Indexes 0-3 correspond to A-D)
    answers: {
        q1_attention: number | null;
        q2_decision: number | null;
        q3_emotion: number | null;
        q4_social: number | null;
        q5_discipline: number | null;
    };

    // Completion state
    isOnboarded: boolean;

    // Actions
    setTempAuth: (token: string, email: string) => void;
    setAnswer: (questionKey: keyof OnboardingState['answers'], answerIndex: number) => void;
    setOnboarded: (status: boolean) => void;
    clearState: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
    tempJwt: null,
    userEmail: null,
    isOnboarded: false,
    answers: {
        q1_attention: null,
        q2_decision: null,
        q3_emotion: null,
        q4_social: null,
        q5_discipline: null,
    },

    setTempAuth: (token: string, email: string) =>
        set(() => ({ tempJwt: token, userEmail: email })),

    setAnswer: (questionKey, answerIndex) =>
        set((state) => ({
            answers: {
                ...state.answers,
                [questionKey]: answerIndex,
            },
        })),

    setOnboarded: (status: boolean) =>
        set(() => ({ isOnboarded: status })),

    clearState: () =>
        set(() => ({
            tempJwt: null,
            userEmail: null,
            isOnboarded: false,
            answers: {
                q1_attention: null,
                q2_decision: null,
                q3_emotion: null,
                q4_social: null,
                q5_discipline: null,
            },
        })),
}));
