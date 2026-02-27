import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator, Platform } from 'react-native';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { API_CONFIG } from '../config/apiConfig';

const QUESTIONS = [
    {
        key: 'q1_attention',
        text: "When you start a new task or project, how do you usually progress?",
        options: [
            "I dive in immediately and power through until I hit a block.",
            "I map out a step-by-step plan and follow it strictly.",
            "I juggle it with a few other things to keep my mind engaged.",
            "I start strong, but often need to pivot to refresh my energy."
        ]
    },
    {
        key: 'q2_decision',
        text: "You have a free weekend with zero obligations. How do you decide what to do?",
        options: [
            "I decide in the moment based entirely on how I feel.",
            "I generally know what I want to achieve and execute that plan.",
            "I wait to see what my friends/family are doing and join in.",
            "I spend a lot of time weighing my options before committing."
        ]
    },
    {
        key: 'q3_emotion',
        text: "When something unexpected completely derails your schedule for the day, what is your internal reaction?",
        options: [
            "Frustration, and it takes me a while to recalibrate.",
            "A brief moment of annoyance, but I quickly restructure my day.",
            "I welcome the chaos; routine can be boring anyway.",
            "I immediately look for who or what caused the disruption to understand why."
        ]
    },
    {
        key: 'q4_social',
        text: "How do you usually interact with notification bubbles on your phone?",
        options: [
            "I clear them immediately; I hate seeing unread badges.",
            "I check them at specific times or when I take breaks.",
            "I ignore most of them unless they belong to specific people.",
            "I let them pile up; I'll get to them when I get to them."
        ]
    },
    {
        key: 'q5_discipline',
        text: "If you miss two days of a new habit you are trying to build, what happens on day three?",
        options: [
            "I feel guilty and try to do double the work to make up for it.",
            "I just pick up where I left off as if nothing happened.",
            "I usually abandon the habit; the streak is broken.",
            "I re-evaluate if the habit is actually working for me and tweak it."
        ]
    }
];

export default function ProfilingFlow() {
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const { setAnswer, tempJwt, answers, clearState } = useOnboardingStore();

    const handleNext = async () => {
        if (selectedOption === null) return;

        const currentQuestionKey = QUESTIONS[currentStep].key as keyof typeof answers;
        setAnswer(currentQuestionKey, selectedOption);

        if (currentStep < QUESTIONS.length - 1) {
            setCurrentStep(prev => prev + 1);
            setSelectedOption(null);
        } else {
            // Final step: submit to backend
            setLoading(true);
            try {
                // Construct final payload by copying state answers and overriding the last one
                // Because setAnswer might not be fully flushed synchronously here due to Zustand batching,
                // we manually build what the final state will be to be safe:
                const finalAnswers = {
                    ...answers,
                    [currentQuestionKey]: selectedOption
                };

                const response = await fetch(`${API_CONFIG.BASE_URL}/api/onboarding/complete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tempJwt}`
                    },
                    body: JSON.stringify({ answers: finalAnswers })
                });

                const data = await response.json();
                setLoading(false);

                if (response.ok) {
                    Alert.alert(
                        "Onboarding Complete!",
                        `Your Archetype: ${data.archetype}`,
                        [{
                            text: "Awesome", onPress: () => {
                                useOnboardingStore.getState().setOnboarded(true);
                            }
                        }]
                    );
                } else {
                    Alert.alert("Error", data.message || 'Failed to complete onboarding');
                }
            } catch (error) {
                setLoading(false);
                Alert.alert("Network Error", "Could not reach the server.");
            }
        }
    };

    const currentQ = QUESTIONS[currentStep];
    const progressPercent = ((currentStep + 1) / QUESTIONS.length) * 100;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                {/* Progress Bar Header */}
                <View style={styles.header}>
                    <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
                </View>

                <View style={styles.content}>
                    <Text style={styles.questionCounter}>Question {currentStep + 1} of 5</Text>
                    <Text style={styles.questionText}>
                        {currentQ.text}
                    </Text>

                    <View style={styles.optionsContainer}>
                        {currentQ.options.map((opt, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.card,
                                    selectedOption === index && styles.cardSelected
                                ]}
                                onPress={() => setSelectedOption(index)}
                            >
                                <Text style={[
                                    styles.cardText,
                                    selectedOption === index && styles.cardTextSelected
                                ]}>
                                    {opt}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.nextButton, selectedOption === null && styles.nextButtonDisabled]}
                    disabled={selectedOption === null || loading}
                    onPress={handleNext}
                >
                    {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <Text style={styles.nextText}>{currentStep === QUESTIONS.length - 1 ? "Finish" : "Continue"}</Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#FAFAFA' },
    container: { flex: 1, paddingHorizontal: 24, paddingBottom: 24 },
    header: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, marginBottom: 40, marginTop: 20 },
    progressBar: { height: '100%', backgroundColor: '#111827', borderRadius: 3 },
    content: { flex: 1 },
    questionCounter: { fontSize: 14, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 },
    questionText: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 40, lineHeight: 34 },
    optionsContainer: { gap: 16 },
    card: { backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
    cardSelected: { borderColor: '#111827', backgroundColor: '#F3F4F6', borderWidth: 2 },
    cardText: { fontSize: 16, color: '#4B5563', lineHeight: 24 },
    cardTextSelected: { color: '#111827', fontWeight: '700' },
    nextButton: { backgroundColor: '#111827', padding: 20, borderRadius: 16, alignItems: 'center', marginTop: 24 },
    nextButtonDisabled: { backgroundColor: '#D1D5DB' },
    nextText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});
