import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert,
    ActivityIndicator, Platform, TextInput, ScrollView, KeyboardAvoidingView,
    Modal, Pressable, Animated, Dimensions
} from 'react-native';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { API_CONFIG, getApiBaseCandidates } from '../config/apiConfig';
import { triggerHaptic } from '../utils/haptics';

const { width } = Dimensions.get('window');

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

const CATEGORIES = ["Academic", "Professional", "Personal", "Health", "Miscellaneous"];

export default function ProfilingFlow() {
    const [flowStage, setFlowStage] = useState<'questions' | 'goals' | 'preview'>('questions');
    const [currentStep, setCurrentStep] = useState(0);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    // Goal fields
    const [goalTitle, setGoalTitle] = useState('');
    const [goalCategory, setGoalCategory] = useState('');
    const [goalDeadline, setGoalDeadline] = useState('2026-05-20');
    const [goalType, setGoalType] = useState<'long' | 'short'>('long');

    // UI States
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Animation Ref
    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    const {
        setAnswer, tempJwt, answers, longTermGoals, shortTermGoals,
        addLongTermGoal, addShortTermGoal, removeGoal, userEmail, completeOnboarding
    } = useOnboardingStore();

    useEffect(() => {
        // Sync selectedOption with store when step changes
        const currentKey = QUESTIONS[currentStep].key as keyof typeof answers;
        setSelectedOption(answers[currentKey] ?? null);
    }, [currentStep, flowStage]);

    const animateTransition = (callback: () => void, direction: 'next' | 'back') => {
        const outValue = direction === 'next' ? -width : width;
        const inValue = direction === 'next' ? width : -width;

        Animated.parallel([
            Animated.timing(slideAnim, { toValue: outValue, duration: 250, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true })
        ]).start(() => {
            callback();
            slideAnim.setValue(inValue);
            Animated.parallel([
                Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
                Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true })
            ]).start();
        });
    };

    const handleAddGoal = () => {
        if (!goalTitle.trim()) return;
        const state = useOnboardingStore.getState();
        const limit = 5;
        if (goalType === 'long' && state.longTermGoals.length >= limit) {
            Alert.alert('Limit Reached', 'You can add up to 5 long-term goals.');
            return;
        }
        if (goalType === 'short' && state.shortTermGoals.length >= limit) {
            Alert.alert('Limit Reached', 'You can add up to 5 short-term goals.');
            return;
        }
        triggerHaptic('medium');
        const newGoal = {
            title: goalTitle.trim(),
            priority: 1,
            category: goalCategory || 'Miscellaneous',
            deadline: goalDeadline || 'TBD'
        };
        if (goalType === 'long') {
            addLongTermGoal(newGoal);
        } else {
            addShortTermGoal(newGoal);
        }

        // RESET ALL FIELDS after adding
        setGoalTitle('');
        setGoalCategory('');
        setGoalDeadline('');
        setGoalType('long');
    };

    const handleNext = () => {
        triggerHaptic('light');
        if (flowStage === 'questions') {
            if (selectedOption !== null) {
                const currentQuestionKey = QUESTIONS[currentStep].key as keyof typeof answers;
                setAnswer(currentQuestionKey, selectedOption);

                if (currentStep < QUESTIONS.length - 1) {
                    animateTransition(() => setCurrentStep(prev => prev + 1), 'next');
                } else {
                    animateTransition(() => setFlowStage('goals'), 'next');
                }
            }
        } else if (flowStage === 'goals') {
            // AUTO-SAVE only if user typed something
            if (goalTitle.trim()) {
                handleAddGoal();
            }

            // Check if we have at least one of each now
            const state = useOnboardingStore.getState();
            if (state.longTermGoals.length > 0 && state.shortTermGoals.length > 0) {
                animateTransition(() => setFlowStage('preview'), 'next');
            } else if (!goalTitle.trim()) {
                // Only show alert if nothing is pending in the input
                Alert.alert("Neural Protocol Incomplete", "Please establish at least one Long Term and one Short Term directive to proceed.");
            }
        }
    };

    const handleBack = () => {
        triggerHaptic('light');
        if (flowStage === 'preview') {
            animateTransition(() => setFlowStage('goals'), 'back');
        } else if (flowStage === 'goals') {
            animateTransition(() => {
                setFlowStage('questions');
                setCurrentStep(QUESTIONS.length - 1);
            }, 'back');
        } else if (flowStage === 'questions' && currentStep > 0) {
            animateTransition(() => setCurrentStep(prev => prev - 1), 'back');
        }
    };

    const calculateArchetype = () => {
        let planner = 0, explorer = 0, reactor = 0, perfectionist = 0;
        const a = answers;
        if (a.q1_attention === 0) perfectionist++; else if (a.q1_attention === 1) planner++; else if (a.q1_attention === 2) reactor++; else if (a.q1_attention === 3) explorer++;
        if (a.q2_decision === 0) explorer++; else if (a.q2_decision === 1) planner++; else if (a.q2_decision === 2) reactor++; else if (a.q2_decision === 3) perfectionist++;
        if (a.q3_emotion === 0) perfectionist++; else if (a.q3_emotion === 1 || a.q3_emotion === 3) planner++; else if (a.q3_emotion === 2) explorer++;
        if (a.q4_social === 0) reactor++; else if (a.q4_social === 1) planner++; else if (a.q4_social === 2) perfectionist++; else if (a.q4_social === 3) explorer++;
        if (a.q5_discipline === 0) perfectionist++; else if (a.q5_discipline === 1) planner++; else if (a.q5_discipline === 2) reactor++; else if (a.q5_discipline === 3) explorer++;

        const scores = [
            { name: 'Focused Planner', score: planner },
            { name: 'Intuitive Explorer', score: explorer },
            { name: 'Social Reactor', score: reactor },
            { name: 'Perfectionist', score: perfectionist },
        ];
        scores.sort((a, b) => b.score - a.score);
        return scores[0].name;
    };

    const handleFinish = async () => {
        triggerHaptic('heavy');
        setLoading(true);

        const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 5000) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            try {
                return await fetch(url, { ...options, signal: controller.signal });
            } finally {
                clearTimeout(timeoutId);
            }
        };

        try {
            const state = useOnboardingStore.getState();

            // Use actual answers with 0 as safe fallback
            const safeAnswers = {
                q1_attention: state.answers.q1_attention ?? 0,
                q2_decision: state.answers.q2_decision ?? 0,
                q3_emotion: state.answers.q3_emotion ?? 0,
                q4_social: state.answers.q4_social ?? 0,
                q5_discipline: state.answers.q5_discipline ?? 0,
            };

            const personality = {
                chronotype: safeAnswers.q1_attention === 1 ? "early_bird" : "night_owl",
                energy_peaks: safeAnswers.q1_attention === 1 ? ["06:00-11:00", "16:00-20:00"] : ["14:00-18:00", "22:00-02:00"],
                distraction_triggers: safeAnswers.q4_social === 0 ? ["notifications", "instagram"] : ["whatsapp", "youtube"],
                focus_style: safeAnswers.q2_decision === 1 ? "deep_work_mornings" : "flexible_execution",
                answers: safeAnswers
            };

            const finalPayload = {
                user_id: state.userEmail ? state.userEmail.split('@')[0] : "unknown_user",
                current_date: new Date().toISOString().split('T')[0],
                current_day: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()),
                personality,
                timetable: [],
                long_term_goals: state.longTermGoals,
                short_term_goals: state.shortTermGoals,
                misc_commitments: [],
                today_deadlines: []
            };

            const fallbackArchetype = calculateArchetype();
            const candidates = [API_CONFIG.BASE_URL, ...getApiBaseCandidates()]
                .filter((url, index, arr) => arr.indexOf(url) === index);

            let lastError: unknown = null;

            for (const baseUrl of candidates) {
                try {
                    const response = await fetchWithTimeout(
                        `${baseUrl}/api/onboarding/complete`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(finalPayload)
                        },
                        5000
                    );

                    let data: any = {};
                    try {
                        data = await response.json();
                    } catch {
                        data = {};
                    }

                    if (response.ok) {
                        triggerHaptic('heavy');
                        completeOnboarding(data.archetype || fallbackArchetype || 'CYBER UNIT');
                        return;
                    }

                    Alert.alert("Error", `[${response.status}] ${data.message || 'Failed to complete onboarding.'}`);
                    return;
                } catch (error) {
                    lastError = error;
                }
            }

            console.warn('Onboarding completion failed on all candidates:', lastError);
            completeOnboarding(fallbackArchetype || 'CYBER UNIT');
            Alert.alert('Offline mode', 'Backend not reachable right now. Proceeding to landing page locally.');
        } catch (error: any) {
            console.warn('Onboarding completion unexpected error:', error);
            completeOnboarding(calculateArchetype() || 'CYBER UNIT');
            Alert.alert("Offline mode", "Could not reach the neural server. Proceeding locally.");
        } finally {
            setLoading(false);
        }
    };

    const ProgressBar = () => {
        const totalSteps = 7; // 5 questions + 1 goals + 1 preview
        let activeStep = 0;
        if (flowStage === 'questions') activeStep = currentStep + 1;
        else if (flowStage === 'goals') activeStep = 6;
        else if (flowStage === 'preview') activeStep = 7;

        return (
            <View style={styles.progressHeader}>
                <View style={styles.progressContainer}>
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <View key={i} style={[styles.progressSegment, i + 1 <= activeStep && styles.progressSegmentActive]} />
                    ))}
                </View>
                <Text style={styles.stepText}>PROTOCOL STEP {activeStep} OF {totalSteps}</Text>
            </View>
        );
    };

    const DatePickerModal = () => {
        const years = ["2026", "2027", "2028"];
        const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
        const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));

        const [y, setY] = useState("2026");
        const [m, setM] = useState("05");
        const [d, setD] = useState("20");

        return (
            <Modal visible={showDatePicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.pickerPanel}>
                        <Text style={styles.pickerTitle}>SELECT DEADLINE</Text>
                        <View style={styles.reelContainer}>
                            <Reel data={days} selected={d} onSelect={setD} label="Day" />
                            <Reel data={months} selected={m} onSelect={setM} label="Month" />
                            <Reel data={years} selected={y} onSelect={setY} label="Year" />
                        </View>
                        <TouchableOpacity style={styles.confirmBtn} onPress={() => { setGoalDeadline(`${y}-${m}-${d}`); setShowDatePicker(false); }}>
                            <Text style={styles.confirmBtnText}>SET DATE</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        );
    };

    const Reel = ({ data, selected, onSelect, label }: any) => (
        <View style={styles.reelColumn}>
            <Text style={styles.reelLabel}>{label}</Text>
            <View style={styles.reelScroll}>
                <ScrollView showsVerticalScrollIndicator={false} snapToInterval={40}>
                    {data.map((item: string) => (
                        <TouchableOpacity key={item} style={[styles.reelItem, selected === item && styles.reelItemActive]} onPress={() => onSelect(item)}>
                            <Text style={[styles.reelText, selected === item && styles.reelTextActive]}>{item}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );

    const renderQuestions = () => (
        <View style={styles.content}>
            <Text style={styles.questionCounter}>NEURAL PROFILING</Text>
            <Text style={styles.questionText}>{QUESTIONS[currentStep].text}</Text>
            <View style={styles.optionsContainer}>
                {QUESTIONS[currentStep].options.map((opt, index) => (
                    <TouchableOpacity key={index} style={[styles.card, selectedOption === index && styles.cardSelected]} onPress={() => setSelectedOption(index)}>
                        <Text style={[styles.cardText, selectedOption === index && styles.cardTextSelected]}>{opt}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    const renderGoals = () => (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.questionCounter}>STRATEGIC PLANNING</Text>
            <Text style={styles.questionText}>Establish your long-term & short-term objectives.</Text>

            <View style={styles.goalForm}>
                <View style={styles.typeSelector}>
                    <TouchableOpacity style={[styles.typeBtn, goalType === 'long' && styles.typeBtnActive]} onPress={() => setGoalType('long')}>
                        <Text style={[styles.typeBtnText, goalType === 'long' && styles.typeBtnTextActive]}>LONG TERM</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.typeBtn, goalType === 'short' && styles.typeBtnActive]} onPress={() => setGoalType('short')}>
                        <Text style={[styles.typeBtnText, goalType === 'short' && styles.typeBtnTextActive]}>SHORT TERM</Text>
                    </TouchableOpacity>
                </View>

                <TextInput style={styles.input} placeholder="Goal Title (e.g. Finish DSA)" placeholderTextColor="#475569" value={goalTitle} onChangeText={setGoalTitle} />

                <View style={styles.row}>
                    <TouchableOpacity style={[styles.input, { flex: 1, marginRight: 8, justifyContent: 'center' }]} onPress={() => setShowCategoryPicker(true)}>
                        <View style={styles.selectorRow}>
                            <Text style={{ color: goalCategory ? '#F8FAFC' : '#475569', fontSize: 13 }}>{goalCategory || 'Select...'}</Text>
                            <Text style={styles.selectorChevron}>⌄</Text>
                        </View>
                        <Text style={styles.smallLabel}>CATEGORY</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.input, { flex: 1, justifyContent: 'center' }]} onPress={() => setShowDatePicker(true)}>
                        <View style={styles.selectorRow}>
                            <Text style={{ color: '#F8FAFC', fontSize: 13 }}>{goalDeadline}</Text>
                            <Text style={styles.selectorChevron}>⌄</Text>
                        </View>
                        <Text style={styles.smallLabel}>DEADLINE</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.addButton} onPress={handleAddGoal}>
                    <Text style={styles.addText}>+ ADD GOAL</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.goalList}>
                <Text style={styles.listTitle}>LONG TERM ({longTermGoals.length})</Text>
                {longTermGoals.map(g => (
                    <View key={g.id} style={styles.goalItem}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>{g.title}</Text>
                            <Text style={styles.itemMeta}>{g.category.toUpperCase()} • {g.deadline}</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeGoal('long', g.id)} style={styles.removeCircle}>
                            <Text style={styles.removeText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                ))}
                <Text style={[styles.listTitle, { marginTop: 24 }]}>SHORT TERM ({shortTermGoals.length})</Text>
                {shortTermGoals.map(g => (
                    <View key={g.id} style={styles.goalItem}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemTitle}>{g.title}</Text>
                            <Text style={styles.itemMeta}>{g.category.toUpperCase()} • {g.deadline}</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeGoal('short', g.id)} style={styles.removeCircle}>
                            <Text style={styles.removeText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                ))}
                <View style={{ height: 40 }} />
            </View>
        </ScrollView>
    );

    const renderPreview = () => {
        const archetype = calculateArchetype();
        return (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.questionCounter}>NEURAL CONFIRMATION</Text>
                <Text style={styles.questionText}>Review your protocol parameters before initiation.</Text>

                <View style={styles.previewCard}>
                    <Text style={styles.previewHeader}>ARCHETYPE IDENTIFIED</Text>
                    <Text style={styles.previewArchetype}>{archetype.toUpperCase()}</Text>

                    <View style={styles.previewSection}>
                        <Text style={styles.previewLabel}>BEHAVIORAL MAPPING</Text>
                        {QUESTIONS.map((q, idx) => {
                            const ansIdx = (answers as any)[q.key];
                            return (
                                <View key={q.key} style={styles.previewQuestionRow}>
                                    <View style={styles.previewQIdxContainer}>
                                        <Text style={styles.previewQIdx}>{idx + 1}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.previewQBody}>{q.text}</Text>
                                        <Text style={styles.previewQAnswer}>{q.options[ansIdx] || 'No Response'}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    <View style={[styles.previewSection, { borderBottomWidth: 0 }]}>
                        <Text style={styles.previewLabel}>STRATEGIC DIRECTIVES</Text>

                        <Text style={styles.previewSubLabel}>LONG TERM MISSION</Text>
                        {longTermGoals.map(g => (
                            <View key={g.id} style={styles.previewGoalRow}>
                                <Text style={styles.previewDot}>{'>'}</Text>
                                <Text style={styles.previewItem}>{g.title} <Text style={styles.previewTag}>[{g.category}]</Text></Text>
                            </View>
                        ))}

                        <Text style={[styles.previewSubLabel, { marginTop: 20 }]}>SHORT TERM DIRECTIVES</Text>
                        {shortTermGoals.map(g => (
                            <View key={g.id} style={styles.previewGoalRow}>
                                <Text style={styles.previewDot}>{'>'}</Text>
                                <Text style={styles.previewItem}>{g.title} <Text style={styles.previewTag}>[{g.category}]</Text></Text>
                            </View>
                        ))}
                    </View>
                </View>
                <View style={{ height: 60 }} />
            </ScrollView>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <ProgressBar />
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
                    {flowStage === 'questions' && renderQuestions()}
                    {flowStage === 'goals' && renderGoals()}
                    {flowStage === 'preview' && renderPreview()}
                </Animated.View>
            </KeyboardAvoidingView>

            <View style={styles.footer}>
                <View style={styles.row}>
                    {((flowStage === 'questions' && currentStep > 0) || flowStage !== 'questions') && (
                        <TouchableOpacity activeOpacity={0.85} style={styles.backButton} onPress={handleBack}>
                            <Text style={styles.backButtonText}><Text style={styles.navArrow}>⟵</Text> PREVIOUS</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        activeOpacity={0.88}
                        style={[
                            styles.nextButton,
                            flowStage === 'questions' && selectedOption === null && styles.nextButtonDisabled,
                            flowStage === 'goals' && (longTermGoals.length === 0 || shortTermGoals.length === 0) && styles.nextButtonDisabled,
                            flowStage === 'preview' && { backgroundColor: '#22D3EE' }
                        ]}
                        onPress={flowStage === 'preview' ? handleFinish : handleNext}
                        disabled={loading || (flowStage === 'questions' && selectedOption === null)}
                    >
                        {loading ? <ActivityIndicator color="#000" /> : <Text style={[styles.nextButtonText, flowStage === 'preview' && { color: '#000' }]}> 
                            {flowStage === 'preview' ? <>INITIATE <Text style={styles.navArrow}>⟶</Text></> : <>CONTINUE <Text style={styles.navArrow}>⟶</Text></>}
                        </Text>}
                    </TouchableOpacity>
                </View>
            </View>

            <DatePickerModal />
            <Modal visible={showCategoryPicker} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.pickerPanel}>
                        <Text style={styles.pickerTitle}>CATEGORY</Text>
                        {CATEGORIES.map(cat => (
                            <TouchableOpacity key={cat} style={styles.pickerItem} onPress={() => { setGoalCategory(cat); setShowCategoryPicker(false); }}>
                                <Text style={[styles.pickerItemText, goalCategory === cat && styles.pickerItemTextActive]}>{cat}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: '#1E293B', marginTop: 10 }]} onPress={() => setShowCategoryPicker(false)}>
                            <Text style={styles.confirmBtnText}>CANCEL</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#0A0C10' },
    progressHeader: { paddingHorizontal: 24, marginTop: 20, marginBottom: 30 },
    progressContainer: { flexDirection: 'row', gap: 6, marginBottom: 12 },
    progressSegment: { flex: 1, height: 4, backgroundColor: '#1E293B', borderRadius: 2 },
    progressSegmentActive: { backgroundColor: '#22D3EE' },
    stepText: { color: '#475569', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textAlign: 'center' },
    container: { flex: 1, paddingHorizontal: 24 },
    content: { flex: 1 },
    questionCounter: { fontSize: 11, fontWeight: '900', color: '#22D3EE', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 2 },
    questionText: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', marginBottom: 32, lineHeight: 36 },
    optionsContainer: { gap: 14 },
    card: { backgroundColor: '#111827', padding: 22, borderRadius: 20, borderWidth: 1, borderColor: '#1E293B' },
    cardSelected: { borderColor: '#22D3EE', backgroundColor: 'rgba(34, 211, 238, 0.08)', borderWidth: 1.5 },
    cardText: { fontSize: 16, color: '#94A3B8', lineHeight: 24 },
    cardTextSelected: { color: '#F8FAFC', fontWeight: '700' },
    footer: { paddingHorizontal: 24, paddingBottom: 34, paddingTop: 14 },
    row: { flexDirection: 'row', gap: 24, alignItems: 'center', justifyContent: 'center' },
    backButton: {
        width: 148,
        height: 58,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#46556E',
        backgroundColor: '#111827',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
        elevation: 7,
    },
    backButtonText: { color: '#D4DEE9', fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
    nextButton: {
        width: 148,
        height: 58,
        backgroundColor: '#2563EB',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#60A5FA',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 9,
    },
    nextButtonDisabled: { opacity: 0.3 },
    nextButtonText: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.7 },
    navArrow: { fontSize: 18, fontWeight: '900' },
    goalForm: { backgroundColor: '#111827', padding: 22, borderRadius: 24, borderWidth: 1, borderColor: '#1E293B', marginBottom: 24 },
    typeSelector: { flexDirection: 'row', marginBottom: 20, gap: 10 },
    typeBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#1E293B', alignItems: 'center' },
    typeBtnActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
    typeBtnText: { color: '#64748B', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    typeBtnTextActive: { color: '#FFF' },
    input: { backgroundColor: '#0F172A', borderRadius: 16, padding: 18, color: '#F8FAFC', fontSize: 15, borderWidth: 1, borderColor: '#1E293B', marginBottom: 14 },
    addButton: { backgroundColor: '#1E293B', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155', marginTop: 8 },
    addText: { color: '#22D3EE', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
    goalList: { flex: 1 },
    listTitle: { fontSize: 11, fontWeight: '900', color: '#64748B', letterSpacing: 2.5, marginBottom: 14 },
    goalItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', padding: 20, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#1E293B' },
    itemTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
    itemMeta: { color: '#475569', fontSize: 11, marginTop: 6, fontWeight: '800', letterSpacing: 0.5 },
    removeCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1E293B' },
    removeText: { color: '#F87171', fontSize: 14, fontWeight: '500' },
    selectorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    selectorChevron: { color: '#94A3B8', fontSize: 16, marginTop: -1 },
    smallLabel: { position: 'absolute', top: 8, left: 18, fontSize: 9, fontWeight: '800', color: '#475569', letterSpacing: 1 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 24 },
    pickerPanel: { backgroundColor: '#111827', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: '#1E293B' },
    pickerTitle: { fontSize: 12, fontWeight: '900', color: '#22D3EE', letterSpacing: 2, marginBottom: 20, textAlign: 'center' },
    pickerItem: { paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
    pickerItemText: { fontSize: 18, color: '#94A3B8', textAlign: 'center' },
    pickerItemTextActive: { color: '#F8FAFC', fontWeight: '900' },
    confirmBtn: { backgroundColor: '#2563EB', padding: 18, borderRadius: 18, alignItems: 'center', marginTop: 24 },
    confirmBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
    reelContainer: { flexDirection: 'row', justifyContent: 'space-between', height: 160, marginBottom: 10 },
    reelColumn: { flex: 1, alignItems: 'center' },
    reelLabel: { fontSize: 9, fontWeight: '900', color: '#475569', marginBottom: 12 },
    reelScroll: { height: 120, width: '100%' },
    reelItem: { height: 40, justifyContent: 'center', alignItems: 'center' },
    reelItemActive: { backgroundColor: 'rgba(34,211,238,0.1)', borderRadius: 10 },
    reelText: { color: '#475569', fontSize: 16, fontWeight: '600' },
    reelTextActive: { color: '#22D3EE', fontWeight: '800', fontSize: 18 },
    previewCard: { backgroundColor: '#111827', padding: 26, borderRadius: 28, borderWidth: 1, borderColor: '#1E293B', marginBottom: 20 },
    previewHeader: { fontSize: 11, fontWeight: '900', color: '#64748B', letterSpacing: 2, marginBottom: 8 },
    previewArchetype: { fontSize: 24, fontWeight: '900', color: '#22D3EE', marginBottom: 24, textShadowColor: 'rgba(34,211,238,0.3)', textShadowRadius: 10 },
    previewSection: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#1E293B' },
    previewLabel: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 2, marginBottom: 16 },
    previewSubLabel: { fontSize: 9, fontWeight: '900', color: '#475569', letterSpacing: 1.5, marginBottom: 10 },
    previewQuestionRow: { flexDirection: 'row', marginBottom: 18, gap: 12 },
    previewQIdxContainer: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' },
    previewQIdx: { fontSize: 10, fontWeight: '900', color: '#22D3EE' },
    previewQBody: { color: '#F8FAFC', fontSize: 13, marginBottom: 4, fontWeight: '600' },
    previewQAnswer: { color: '#94A3B8', fontSize: 13, fontStyle: 'italic', fontWeight: '400' },
    previewGoalRow: { flexDirection: 'row', gap: 8, marginBottom: 10, alignItems: 'flex-start' },
    previewDot: { color: '#22D3EE', fontSize: 14, fontWeight: '900' },
    previewItem: { color: '#F8FAFC', fontSize: 15, flex: 1, fontWeight: '600', letterSpacing: 0.3 },
    previewTag: { color: '#475569', fontSize: 11, fontWeight: '800' }
});
