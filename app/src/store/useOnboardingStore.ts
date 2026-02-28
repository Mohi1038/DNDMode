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

    // Step 3: Goals
    longTermGoals: Array<{ id: string; title: string; priority: number; category: string; deadline: string }>;
    shortTermGoals: Array<{ id: string; title: string; priority: number; category: string; deadline: string }>;

    // Completion state
    isOnboarded: boolean;
    onboardingArchetype: string | null;
    showOnboardingSuccessToast: boolean;
    pendingJoinCode: string | null;

    // Actions
    setTempAuth: (token: string, email: string) => void;
    setAnswer: (questionKey: keyof OnboardingState['answers'], answerIndex: number) => void;
    addLongTermGoal: (goal: { title: string; priority: number; category: string; deadline: string }) => void;
    addShortTermGoal: (goal: { title: string; priority: number; category: string; deadline: string }) => void;
    removeGoal: (type: 'long' | 'short', id: string) => void;
    setOnboarded: (status: boolean) => void;
    completeOnboarding: (archetype: string) => void;
    clearOnboardingToast: () => void;
    setPendingJoinCode: (code: string | null) => void;
    clearState: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
    tempJwt: null,
    userEmail: null,
    longTermGoals: [],
    shortTermGoals: [],
    isOnboarded: false,
    onboardingArchetype: null,
    showOnboardingSuccessToast: false,
    pendingJoinCode: null,
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

    addLongTermGoal: (goal) =>
        set((state) => ({
            longTermGoals: [
                ...state.longTermGoals,
                { ...goal, id: `lt${state.longTermGoals.length + 1}` },
            ],
        })),

    addShortTermGoal: (goal) =>
        set((state) => ({
            shortTermGoals: [
                ...state.shortTermGoals,
                { ...goal, id: `st${state.shortTermGoals.length + 1}` },
            ],
        })),

    removeGoal: (type, id) =>
        set((state) => ({
            longTermGoals: type === 'long' ? state.longTermGoals.filter((g) => g.id !== id) : state.longTermGoals,
            shortTermGoals: type === 'short' ? state.shortTermGoals.filter((g) => g.id !== id) : state.shortTermGoals,
        })),

    setOnboarded: (status: boolean) =>
        set(() => ({ isOnboarded: status })),

    completeOnboarding: (archetype: string) =>
        set(() => ({
            isOnboarded: true,
            onboardingArchetype: archetype,
            showOnboardingSuccessToast: true,
        })),

    clearOnboardingToast: () =>
        set(() => ({ showOnboardingSuccessToast: false })),

    setPendingJoinCode: (code: string | null) =>
        set(() => ({ pendingJoinCode: code })),

    clearState: () =>
        set(() => ({
            tempJwt: null,
            userEmail: null,
            longTermGoals: [],
            shortTermGoals: [],
            isOnboarded: false,
            onboardingArchetype: null,
            showOnboardingSuccessToast: false,
            pendingJoinCode: null,
            answers: {
                q1_attention: null,
                q2_decision: null,
                q3_emotion: null,
                q4_social: null,
                q5_discipline: null,
            },
        })),
}));
