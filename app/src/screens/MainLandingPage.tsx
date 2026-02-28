import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
    Animated, Modal, Platform, Alert, Easing, Vibration, ActivityIndicator,
    TextInput, Image, FlatList, NativeModules
} from 'react-native';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { API_CONFIG, getApiBaseCandidates } from '../config/apiConfig';

// Safe wrapper: check if the NATIVE module exists before using the JS wrapper
const _imagePickerAvailable = !!NativeModules.ImagePicker;
let _launchImageLibrary: any = null;
if (_imagePickerAvailable) {
    try {
        const picker = require('react-native-image-picker');
        _launchImageLibrary = picker.launchImageLibrary;
    } catch (e) {
        console.warn('react-native-image-picker JS module not found');
    }
}
import FocusModeScreen from './FocusModeScreen';
import GroupDashboardScreen from './GroupDashboardScreen';
import DigitalGovernanceScreen from './DigitalGovernanceScreen';
import FinalJsonPreviewScreen from './FinalJsonPreviewScreen.tsx';
import SuggestedTimetableScreen from './SuggestedTimetableScreen';
import { triggerHaptic } from '../utils/haptics';

const FONT_FAMILY_REGULAR = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' });
const FONT_FAMILY_MEDIUM = Platform.select({ ios: 'System', android: 'sans-serif-medium', default: 'System' });
const FONT_FAMILY_BOLD = Platform.select({ ios: 'System', android: 'sans-serif-bold', default: 'System' });

export default function MainLandingPage() {
    const [showSettings, setShowSettings] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showOcrResult, setShowOcrResult] = useState(false);
    const [ocrData, setOcrData] = useState<any>(null);
    const [focusDuration, setFocusDuration] = useState(25);
    const [isFocusing, setIsFocusing] = useState(false);
    const [isLuminous, setIsLuminous] = useState(true);

    // Group State
    const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);
    const [showGroupCreate, setShowGroupCreate] = useState(false);
    const [showGroupJoin, setShowGroupJoin] = useState(false);
    const [groupNameInput, setGroupNameInput] = useState('');
    const [groupCodeInput, setGroupCodeInput] = useState('');
    const [isGroupLoading, setIsGroupLoading] = useState(false);
    const [showGovernance, setShowGovernance] = useState(false);
    const [showFinalJson, setShowFinalJson] = useState(false);
    const [showSuggestedTimetable, setShowSuggestedTimetable] = useState(false);
    const [configuredApps, setConfiguredApps] = useState<Array<{ id: string; name: string }>>([]);

    // Misc commitments
    const [showAddTimetableItem, setShowAddTimetableItem] = useState(false);
    const [miscCommitments, setMiscCommitments] = useState<Array<{ time: string; description: string; duration_min: number }>>([]);
    const [manualCommitment, setManualCommitment] = useState({
        time: '', description: '', duration_min: ''
    });

    const {
        clearState,
        userEmail,
        answers,
        longTermGoals,
        shortTermGoals,
        onboardingArchetype,
        showOnboardingSuccessToast,
        clearOnboardingToast,
        pendingJoinCode,
        setPendingJoinCode,
    } = useOnboardingStore();
    const activeUserName = userEmail ? userEmail.split('@')[0] : 'NEURAL_UNIT';

    // Animations
    const entranceAnim = useRef(new Animated.Value(0)).current;
    const headerShimmerAnim = useRef(new Animated.Value(0)).current;
    const uploadBtnScale = useRef(new Animated.Value(1)).current;
    const focusBtnScale = useRef(new Animated.Value(1)).current;
    const ocrFadeAnim = useRef(new Animated.Value(0)).current;
    const luminousToggleAnim = useRef(new Animated.Value(1)).current;
    const successToastAnim = useRef(new Animated.Value(-120)).current;
    const successToastFade = useRef(new Animated.Value(0)).current;
    const [showLandingSuccessToast, setShowLandingSuccessToast] = useState(false);

    useEffect(() => {
        Animated.timing(entranceAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(headerShimmerAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(headerShimmerAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.delay(4000)
            ])
        ).start();
    }, []);

    useEffect(() => {
        if (!showOnboardingSuccessToast) {
            return;
        }

        setShowLandingSuccessToast(true);
        Animated.parallel([
            Animated.spring(successToastAnim, {
                toValue: 0,
                bounciness: 10,
                useNativeDriver: true,
            }),
            Animated.timing(successToastFade, {
                toValue: 1,
                duration: 280,
                useNativeDriver: true,
            }),
        ]).start();

        const timeout = setTimeout(() => {
            Animated.parallel([
                Animated.timing(successToastAnim, {
                    toValue: -120,
                    duration: 280,
                    useNativeDriver: true,
                }),
                Animated.timing(successToastFade, {
                    toValue: 0,
                    duration: 260,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                setShowLandingSuccessToast(false);
                clearOnboardingToast();
            });
        }, 2300);

        return () => clearTimeout(timeout);
    }, [showOnboardingSuccessToast, successToastAnim, successToastFade, clearOnboardingToast]);

    const handleCreateGroup = async () => {
        if (!groupNameInput.trim()) return;
        setIsGroupLoading(true);
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/groups/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: groupNameInput, userName: activeUserName })
            });
            const data = await response.json();
            if (response.ok) {
                setCurrentGroupId(data.groupId);
                setShowGroupCreate(false);
                setGroupNameInput('');
                triggerHaptic('heavy');
            }
        } catch (error) {
            Alert.alert('System Error', 'Neural link failed to create group.');
        } finally {
            setIsGroupLoading(false);
        }
    };

    const handleJoinGroup = async () => {
        if (!groupCodeInput.trim()) return;
        const normalizedCode = (() => {
            const raw = groupCodeInput.trim();
            if (raw.includes('/join/')) {
                const afterJoin = raw.split('/join/')[1] || '';
                return afterJoin.split(/[?#]/)[0].trim().toUpperCase();
            }
            return raw.toUpperCase();
        })();

        setIsGroupLoading(true);
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/api/groups/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: normalizedCode, userName: activeUserName })
            });
            const data = await response.json();
            if (response.ok) {
                setCurrentGroupId(data.id);
                setShowGroupJoin(false);
                setGroupCodeInput('');
                triggerHaptic('medium');
            } else {
                Alert.alert('Join Error', data.error || 'Invalid neural code.');
            }
        } catch (error) {
            Alert.alert('System Error', 'Failed to synchronize with group.');
        } finally {
            setIsGroupLoading(false);
        }
    };

    useEffect(() => {
        if (showOcrResult) {
            Animated.timing(ocrFadeAnim, {
                toValue: 1,
                duration: 400,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true
            }).start();
        } else {
            ocrFadeAnim.setValue(0);
        }
    }, [showOcrResult]);

    useEffect(() => {
        if (!pendingJoinCode) {
            return;
        }

        setGroupCodeInput(pendingJoinCode);
        setShowGroupJoin(true);
        setPendingJoinCode(null);
    }, [pendingJoinCode, setPendingJoinCode]);

    const handleStartFocus = () => {
        triggerHaptic('heavy');
        Animated.sequence([
            Animated.timing(focusBtnScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
            Animated.timing(focusBtnScale, { toValue: 1, duration: 150, useNativeDriver: true })
        ]).start(() => {
            setIsFocusing(true);
        });
    };

    const handleUploadTimetable = async () => {
        triggerHaptic('medium');
        Animated.sequence([
            Animated.timing(uploadBtnScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
            Animated.timing(uploadBtnScale, { toValue: 1, duration: 150, useNativeDriver: true })
        ]).start();

        if (!_launchImageLibrary) {
            Alert.alert('Not Available', 'Image picker native module is not linked. Please rebuild the app.');
            return;
        }

        const result = await _launchImageLibrary({
            mediaType: 'photo',
            includeBase64: false,
        });

        if (result.didCancel || !result.assets || result.assets.length === 0) return;

        const asset = result.assets[0];
        setIsUploading(true);
        setShowOcrResult(false);

        try {
            const formData = new FormData();
            formData.append('timetable', {
                uri: Platform.OS === 'ios' ? asset.uri?.replace('file://', '') : asset.uri,
                type: asset.type || 'image/jpeg',
                name: asset.fileName || 'timetable.jpg',
            } as any);

            const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 70000) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                try {
                    return await fetch(url, { ...options, signal: controller.signal });
                } finally {
                    clearTimeout(timeoutId);
                }
            };

            const baseCandidates = [API_CONFIG.BASE_URL, ...getApiBaseCandidates()]
                .filter((url, index, arr) => arr.indexOf(url) === index);

            let lastNetworkError: unknown = null;
            let handled = false;

            for (const baseUrl of baseCandidates) {
                try {
                    const response = await fetchWithTimeout(`${baseUrl}/api/timetable/upload`, {
                        method: 'POST',
                        body: formData,
                    }, 70000);

                    const json = await response.json();
                    if (response.ok) {
                        setOcrData(json.data);
                        triggerHaptic('medium');
                        setShowOcrResult(true);
                    } else {
                        Alert.alert('Upload Failed', json.message || 'Error parsing timetable.');
                    }
                    handled = true;
                    break;
                } catch (error) {
                    lastNetworkError = error;
                }
            }

            if (!handled) {
                console.error('Timetable upload failed on all API base candidates:', lastNetworkError);
                Alert.alert('Network Error', 'OCR request timed out or backend is unreachable. Please try again.');
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Network Error', 'Could not reach the OCR server.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleLogout = () => {
        triggerHaptic('medium');
        setShowSettings(false);
        clearState();
    };

    const toggleLuminous = () => {
        const newValue = !isLuminous;
        triggerHaptic('light');
        setIsLuminous(newValue);

        Animated.spring(luminousToggleAnim, {
            toValue: newValue ? 1 : 0,
            friction: 8,
            tension: 50,
            useNativeDriver: true
        }).start();
    };

    const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
    const opacity = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

    const buildPersonality = () => ({
        chronotype: (answers.q1_attention ?? 0) === 1 ? 'early_bird' : 'night_owl',
        energy_peaks: (answers.q1_attention ?? 0) === 1
            ? ['06:00-11:00', '16:00-20:00']
            : ['14:00-18:00', '22:00-02:00'],
        distraction_triggers: configuredApps.length > 0
            ? configuredApps.map(app => app.name)
            : (answers.q4_social ?? 0) === 0
                ? ['instagram', 'whatsapp', 'youtube']
                : ['whatsapp', 'youtube'],
        focus_style: (answers.q2_decision ?? 0) === 1 ? 'deep_work_mornings' : 'flexible_execution',
    });

    const timetable = Array.isArray(ocrData?.timetable)
        ? ocrData.timetable
        : Array.isArray(ocrData?.items)
            ? ocrData.items
            : [];

    const finalJson = {
        user_id: activeUserName,
        current_date: new Date().toISOString().split('T')[0],
        current_day: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()),
        personality: buildPersonality(),
        timetable,
        long_term_goals: longTermGoals,
        short_term_goals: shortTermGoals,
        misc_commitments: miscCommitments,
        apps_to_align_with_focus_timer: configuredApps,
        today_deadlines: [] as Array<{ title: string; due: string }>,
        archetype: onboardingArchetype,
    };

    return (
        <View style={styles.masterContainer}>
            {showLandingSuccessToast && (
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.successToast,
                        {
                            opacity: successToastFade,
                            transform: [{ translateY: successToastAnim }],
                        },
                    ]}
                >
                    <Text style={styles.successToastTitle}>Successfully onboarded</Text>
                    <Text style={styles.successToastSubtitle}>{onboardingArchetype || 'CYBER UNIT'}</Text>
                </Animated.View>
            )}

            <View style={[styles.bgLayer, { backgroundColor: '#0F1115' }]} />
            <View style={[styles.bgLayer, { backgroundColor: '#141821', opacity: 0.7, top: '30%', bottom: '30%' }]} />
            <View style={[styles.bgLayer, { backgroundColor: '#0B0E13', opacity: 0.9, top: '60%' }]} />
            {isLuminous && <View style={styles.ambientGlow} />}

            <SafeAreaView style={styles.safeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => { triggerHaptic('light'); setShowSettings(true); }} style={styles.iconButton}>
                        <View style={styles.hamburgerLine} />
                        <View style={[styles.hamburgerLine, { width: 16 }]} />
                        <View style={styles.hamburgerLine} />
                    </TouchableOpacity>
                    <View style={styles.titleContainer}>
                        <Text style={styles.headerTitle}>ChronoForge</Text>
                        {isLuminous && (
                            <Animated.Text style={[styles.headerTitleGlow, { opacity: headerShimmerAnim }]}>
                                ChronoForge
                            </Animated.Text>
                        )}
                    </View>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
                        <View style={styles.glassCard}>
                            <View style={styles.cardHighlight} />
                            <View style={styles.cardHeaderRow}>
                                <Text style={styles.sectionTitle}>Classroom Timetable</Text>
                                <View style={styles.aiBadge}><Text style={styles.aiBadgeText}>AI VISION</Text></View>
                            </View>
                            <Text style={styles.sectionSubtitle}>Quantify and digitize your schedule via neural extraction.</Text>
                            <TouchableOpacity activeOpacity={1} onPress={handleUploadTimetable}>
                                <Animated.View style={[styles.uploadButton, { transform: [{ scale: uploadBtnScale }] }]}>
                                    {isUploading ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <ActivityIndicator color={isLuminous ? "#22D3EE" : "#94A3B8"} size="small" style={{ marginRight: 10 }} />
                                            <Text style={isLuminous ? styles.uploadButtonTextActive : styles.uploadButtonText}>Extracting via OCR...</Text>
                                        </View>
                                    ) : (
                                        <Text style={styles.uploadButtonText}>Upload Image</Text>
                                    )}
                                    {isLuminous && <View style={styles.buttonNeonEdge} />}
                                </Animated.View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.uploadButton, { marginTop: 12, borderStyle: 'dashed' }]}
                                onPress={() => setShowAddTimetableItem(true)}
                            >
                                <Text style={[styles.uploadButtonText, { color: '#94A3B8' }]}>+ ADD MISC COMMITMENT</Text>
                            </TouchableOpacity>
                            {showOcrResult && (
                                <Animated.View style={[styles.cyberTerminal, { opacity: ocrFadeAnim }]}>
                                    <View style={styles.terminalHeader}>
                                        <Text style={styles.terminalTitle}>DATA.EXTRACTION_COMPLETE</Text>
                                        <TouchableOpacity onPress={() => setShowOcrResult(false)}>
                                            <View style={styles.closeCircle}><Text style={styles.closeCircleText}>✕</Text></View>
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView style={styles.terminalScroll} nestedScrollEnabled={true}>
                                        <Text style={styles.terminalText}>{JSON.stringify(ocrData, null, 2)}</Text>
                                    </ScrollView>
                                </Animated.View>
                            )}
                        </View>

                        <View style={styles.glassCard}>
                            <View style={styles.cardHighlight} />
                            <Text style={styles.sectionTitle}>Execution Parameters</Text>
                            <Text style={styles.sectionSubtitle}>Select temporal duration and initialize deep focus protocol.</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeSettingsScroll}>
                                {[15, 25, 45, 60, 90, 120, 180, 240].map(mins => {
                                    const isActive = focusDuration === mins;
                                    return (
                                        <TouchableOpacity
                                            key={mins}
                                            activeOpacity={0.8}
                                            style={[styles.timeChip, isActive && styles.timeChipActive]}
                                            onPress={() => { triggerHaptic('light'); setFocusDuration(mins); }}
                                        >
                                            <Text style={[styles.timeLabel, isActive && (isLuminous ? styles.timeLabelActive : { color: '#F8FAFC' })]}>{mins}</Text>
                                            <Text style={[styles.timeValue, isActive && (isLuminous ? styles.timeValueActive : { color: '#38BDF8' })]}>MIN</Text>
                                            {isActive && isLuminous && <View style={styles.chipGlow} />}
                                        </TouchableOpacity>
                                    )
                                })}
                            </ScrollView>
                            <TouchableOpacity activeOpacity={1} onPress={handleStartFocus}>
                                <Animated.View style={[styles.heroButton, { transform: [{ scale: focusBtnScale }] }]}>
                                    <View style={styles.heroButtonBg} />
                                    <Text style={styles.heroButtonText}>INITIATE FOCUS</Text>
                                    {isLuminous && <View style={styles.heroGlow} />}
                                </Animated.View>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.glassCard}>
                            <View style={styles.cardHighlight} />
                            <View style={styles.cardHeaderRow}>
                                <Text style={styles.sectionTitle}>Configure Apps</Text>
                                <View style={[styles.aiBadge, { backgroundColor: '#8B5CF622', borderColor: '#8B5CF6' }]}>
                                    <Text style={[styles.aiBadgeText, { color: '#C084FC' }]}>POLICIES</Text>
                                </View>
                            </View>
                            <Text style={styles.sectionSubtitle}>Define temporal barriers and neural capacity for specific interfaces.</Text>
                            <TouchableOpacity activeOpacity={0.8} onPress={() => { triggerHaptic('heavy'); setShowGovernance(true); }}>
                                <View style={styles.governanceEntryCard}>
                                    <View style={styles.entryGlow} />
                                    <Text style={styles.entryTitle}>CONFIGURE APPS</Text>
                                    <Text style={styles.entryDesc}>Manage app timers, categories, and expansions.</Text>
                                    <Text style={styles.entryArrow}>PROTOCOLS →</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.glassCard, styles.lastCard]}>
                            <View style={styles.cardHighlight} />
                            <Text style={styles.sectionTitle}>Study Groups</Text>
                            <Text style={styles.sectionSubtitle}>Create or join a group to share timetables and align focus periods.</Text>
                            <View style={styles.groupActionsRow}>
                                <TouchableOpacity style={styles.groupBtn} onPress={() => setShowGroupCreate(true)}>
                                    <Text style={styles.groupBtnText}>+ CREATE NEW</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.groupBtn, { backgroundColor: '#1E293B', borderColor: '#334155' }]} onPress={() => setShowGroupJoin(true)}>
                                    <Text style={[styles.groupBtnText, { color: '#94A3B8' }]}>JOIN WITH CODE</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={[styles.glassCard, styles.lastCard]}>
                            <View style={styles.cardHighlight} />
                            <Text style={styles.sectionTitle}>Final Payload JSON</Text>
                            <Text style={styles.sectionSubtitle}>Temporary preview screen for the end payload (dynamic values).</Text>
                            <TouchableOpacity activeOpacity={0.85} onPress={() => setShowFinalJson(true)}>
                                <View style={styles.governanceEntryCard}>
                                    <View style={styles.entryGlow} />
                                    <Text style={styles.entryTitle}>VIEW FINAL JSON</Text>
                                    <Text style={styles.entryDesc}>Includes personality, timetable, goals, misc_commitments and day/date.</Text>
                                    <Text style={styles.entryArrow}>OPEN →</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.glassCard, styles.lastCard]}>
                            <View style={styles.cardHighlight} />
                            <Text style={styles.sectionTitle}>Suggested Timetable</Text>
                            <Text style={styles.sectionSubtitle}>View your suggested class schedule in a structured table screen.</Text>
                            <TouchableOpacity activeOpacity={0.85} onPress={() => setShowSuggestedTimetable(true)}>
                                <View style={styles.governanceEntryCard}>
                                    <View style={styles.entryGlow} />
                                    <Text style={styles.entryTitle}>OPEN TIMETABLE VIEW</Text>
                                    <Text style={styles.entryDesc}>Day-wise table with start time, end time, subject and code.</Text>
                                    <Text style={styles.entryArrow}>OPEN →</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </ScrollView>
            </SafeAreaView>

            {/* Modals */}
            <Modal visible={showSettings} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.settingsPanel}>
                        <View style={styles.settingsHeader}>
                            <Text style={styles.settingsTitle}>SYSTEM CONFIG</Text>
                            <TouchableOpacity onPress={() => setShowSettings(false)}><Text style={styles.closeText}>DONE</Text></TouchableOpacity>
                        </View>
                        <View style={styles.settingsItem}>
                            <Text style={styles.settingsItemText}>Luminous Interface</Text>
                            <TouchableOpacity onPress={toggleLuminous}>
                                <View style={[styles.switchTrack, isLuminous && styles.switchTrackActive]}>
                                    <Animated.View style={[styles.switchKnob, { transform: [{ translateX: luminousToggleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }] }]} />
                                </View>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.settingsDivider} />
                        <TouchableOpacity onPress={handleLogout}><View style={styles.logoutButton}><Text style={styles.logoutText}>TERMINATE SESSION</Text></View></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={isFocusing} animationType="slide" presentationStyle="fullScreen">
                <FocusModeScreen durationMinutes={focusDuration} onEndFocus={() => setIsFocusing(false)} />
            </Modal>

            <Modal visible={showGroupCreate} animationType="fade" transparent={true}>
                <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
                    <View style={[styles.pickerPanel, { marginTop: 0, borderRadius: 32 }]}>
                        <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>NEW NEURAL GROUP</Text>
                            <TouchableOpacity onPress={() => setShowGroupCreate(false)}><Text style={styles.closeText}>CANCEL</Text></TouchableOpacity>
                        </View>
                        <TextInput style={styles.premiumInput} placeholder="GROUP DESIGNATION (NAME)" placeholderTextColor="#475569" value={groupNameInput} onChangeText={setGroupNameInput} />
                        <TouchableOpacity style={styles.confirmButton} onPress={handleCreateGroup}>
                            {isGroupLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmButtonText}>ESTABLISH GROUP</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={showGroupJoin} animationType="fade" transparent={true}>
                <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
                    <View style={[styles.pickerPanel, { marginTop: 0, borderRadius: 32 }]}>
                        <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>JOIN GROUP</Text>
                            <TouchableOpacity onPress={() => setShowGroupJoin(false)}><Text style={styles.closeText}>CANCEL</Text></TouchableOpacity>
                        </View>
                        <TextInput style={styles.premiumInput} placeholder="6-DIGIT PROTOCOL CODE" placeholderTextColor="#475569" value={groupCodeInput} onChangeText={setGroupCodeInput} autoCapitalize="characters" maxLength={6} />
                        <TouchableOpacity style={styles.confirmButton} onPress={handleJoinGroup}>
                            {isGroupLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmButtonText}>SYNCHRONIZE</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={currentGroupId !== null} animationType="slide" presentationStyle="fullScreen">
                {currentGroupId && <GroupDashboardScreen groupId={currentGroupId} userName={activeUserName} onExit={() => setCurrentGroupId(null)} />}
            </Modal>

            <Modal visible={showGovernance} animationType="slide" presentationStyle="fullScreen">
                <DigitalGovernanceScreen
                    onBack={() => setShowGovernance(false)}
                    onConfirmSelection={(apps) => {
                        setConfiguredApps(apps);
                        triggerHaptic('medium');
                        setShowGovernance(false);
                    }}
                />
            </Modal>

            <Modal visible={showAddTimetableItem} animationType="fade" transparent={true}>
                <View style={[styles.modalOverlay, { justifyContent: 'center' }]}>
                    <View style={[styles.pickerPanel, { marginTop: 0, borderRadius: 32 }]}>
                        <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>ADD MISC COMMITMENT</Text>
                            <TouchableOpacity onPress={() => setShowAddTimetableItem(false)}><Text style={styles.closeText}>CANCEL</Text></TouchableOpacity>
                        </View>
                        <TextInput style={styles.premiumInput} placeholder="Description (e.g. GDSC weekly meet)" placeholderTextColor="#475569" value={manualCommitment.description} onChangeText={t => setManualCommitment({ ...manualCommitment, description: t })} />
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <TextInput style={[styles.premiumInput, { flex: 1 }]} placeholder="Time (17:00)" placeholderTextColor="#475569" value={manualCommitment.time} onChangeText={t => setManualCommitment({ ...manualCommitment, time: t })} />
                            <TextInput style={[styles.premiumInput, { flex: 1 }]} placeholder="Duration (min)" placeholderTextColor="#475569" keyboardType="numeric" value={manualCommitment.duration_min} onChangeText={t => setManualCommitment({ ...manualCommitment, duration_min: t })} />
                        </View>

                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={() => {
                                if (!manualCommitment.description.trim() || !manualCommitment.time.trim()) {
                                    Alert.alert('Missing fields', 'Please add time and description.');
                                    return;
                                }

                                triggerHaptic('medium');
                                const payload = {
                                    time: manualCommitment.time.trim(),
                                    description: manualCommitment.description.trim(),
                                    duration_min: Number(manualCommitment.duration_min) || 60,
                                };

                                setMiscCommitments(prev => [...prev, payload]);
                                setOcrData((prev: any) => ({
                                    ...prev,
                                    misc_commitments: [...(prev?.misc_commitments || []), payload]
                                }));
                                setShowAddTimetableItem(false);
                                setManualCommitment({ time: '', description: '', duration_min: '' });
                                setShowOcrResult(true);
                            }}
                        >
                            <Text style={styles.confirmButtonText}>ADD TO SCHEDULE</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={showFinalJson} animationType="slide" presentationStyle="fullScreen">
                <FinalJsonPreviewScreen finalJson={finalJson} onBack={() => setShowFinalJson(false)} />
            </Modal>

            <Modal visible={showSuggestedTimetable} animationType="slide" presentationStyle="fullScreen">
                <SuggestedTimetableScreen
                    timetableData={ocrData}
                    onBack={() => setShowSuggestedTimetable(false)}
                />
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    masterContainer: { flex: 1, backgroundColor: '#0F1115' },
    successToast: {
        position: 'absolute',
        top: 18,
        left: 20,
        right: 20,
        zIndex: 999,
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: '#111827',
        borderWidth: 1,
        borderColor: '#22D3EE',
        shadowColor: '#22D3EE',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
    },
    successToastTitle: {
        color: '#E2E8F0',
        fontSize: 14,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontFamily: FONT_FAMILY_BOLD,
    },
    successToastSubtitle: {
        color: '#22D3EE',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
        letterSpacing: 0.6,
        fontFamily: FONT_FAMILY_MEDIUM,
    },
    bgLayer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
    ambientGlow: { position: 'absolute', top: '10%', left: '20%', right: '20%', height: '30%', backgroundColor: 'rgba(34, 211, 238, 0.05)', borderRadius: 200, transform: [{ scaleY: 1.5 }] },
    safeArea: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)', backgroundColor: 'rgba(15, 17, 21, 0.6)' },
    iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
    hamburgerLine: { width: 22, height: 2, backgroundColor: '#94A3B8', marginVertical: 3, borderRadius: 1 },
    titleContainer: { justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', fontFamily: FONT_FAMILY_BOLD, color: '#F8FAFC', letterSpacing: 1 },
    headerTitleGlow: { position: 'absolute', fontSize: 18, fontWeight: '700', fontFamily: FONT_FAMILY_BOLD, color: '#22D3EE', letterSpacing: 1, textShadowColor: 'rgba(34, 211, 238, 0.8)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
    scrollContent: { padding: 20 },
    glassCard: { backgroundColor: '#161B22', borderRadius: 24, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(34, 211, 238, 0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10, overflow: 'hidden' },
    cardHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.05)' },
    lastCard: { marginBottom: 40 },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: FONT_FAMILY_BOLD, color: '#F1F5F9', letterSpacing: 0.5 },
    aiBadge: { backgroundColor: 'rgba(34, 211, 238, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(34, 211, 238, 0.3)' },
    aiBadgeText: { color: '#22D3EE', fontSize: 10, fontWeight: '800', fontFamily: FONT_FAMILY_BOLD, letterSpacing: 1 },
    sectionSubtitle: { fontSize: 13, fontFamily: FONT_FAMILY_REGULAR, color: '#94A3B8', lineHeight: 20, marginBottom: 24 },
    uploadButton: { backgroundColor: '#1E293B', paddingVertical: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
    buttonNeonEdge: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(37, 99, 235, 0.5)' },
    uploadButtonText: { color: '#E2E8F0', fontSize: 15, fontWeight: '600', fontFamily: FONT_FAMILY_MEDIUM, letterSpacing: 0.5 },
    uploadButtonTextActive: { color: '#22D3EE', fontSize: 15, fontWeight: '600', fontFamily: FONT_FAMILY_MEDIUM, letterSpacing: 0.5 },
    cyberTerminal: { marginTop: 20, backgroundColor: '#0F172A', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(34, 211, 238, 0.2)', overflow: 'hidden' },
    terminalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E293B', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#334155' },
    terminalTitle: { color: '#10B981', fontSize: 11, fontWeight: '700', fontFamily: FONT_FAMILY_BOLD, letterSpacing: 1, textShadowColor: 'rgba(16, 185, 129, 0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
    closeCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.05)', justifyContent: 'center', alignItems: 'center' },
    closeCircleText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
    terminalScroll: { maxHeight: 200, padding: 16 },
    terminalText: { color: '#38BDF8', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 18 },
    timeSettingsScroll: { paddingVertical: 6, gap: 8 },
    timeChip: { width: 82, height: 66, backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155', marginRight: 8 },
    timeChipActive: { backgroundColor: 'rgba(37, 99, 235, 0.15)', borderColor: '#2563EB' },
    chipGlow: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 12, borderWidth: 1, borderColor: '#38BDF8', opacity: 0.4 },
    timeLabel: { fontSize: 18, fontWeight: '800', fontFamily: FONT_FAMILY_BOLD, color: '#64748B', marginBottom: 1 },
    timeLabelActive: { color: '#F8FAFC', textShadowColor: '#38BDF8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
    timeValue: { fontSize: 10, fontWeight: '700', fontFamily: FONT_FAMILY_MEDIUM, color: '#475569', letterSpacing: 0.8 },
    timeValueActive: { color: '#38BDF8' },
    heroButton: { height: 56, marginTop: 10, borderRadius: 16, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2563EB', overflow: 'hidden' },
    heroButtonBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
    heroGlow: { position: 'absolute', top: -10, left: '20%', right: '20%', height: 20, backgroundColor: '#60A5FA', opacity: 0.8, borderRadius: 20, shadowColor: '#60A5FA', shadowOffset: { width: 0, height: 0 }, shadowRadius: 10, shadowOpacity: 1 },
    heroButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', fontFamily: FONT_FAMILY_BOLD, letterSpacing: 1.5 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-start' },
    settingsPanel: { backgroundColor: '#1E293B', marginTop: Platform.OS === 'ios' ? 60 : 40, marginHorizontal: 16, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#334155', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 15 },
    settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    settingsTitle: { fontSize: 14, fontWeight: '800', fontFamily: FONT_FAMILY_BOLD, color: '#F1F5F9', letterSpacing: 2 },
    closeText: { fontSize: 12, color: '#94A3B8', fontWeight: '700', fontFamily: FONT_FAMILY_MEDIUM, letterSpacing: 1 },
    settingsItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    settingsItemText: { fontSize: 15, color: '#CBD5E1', fontWeight: '500', fontFamily: FONT_FAMILY_REGULAR },
    switchTrack: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#334155', padding: 2, justifyContent: 'center' },
    switchTrackActive: { backgroundColor: '#2563EB' },
    switchKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F8FAFC' },
    settingsDivider: { height: 1, backgroundColor: '#334155', marginVertical: 16 },
    logoutButton: { backgroundColor: 'rgba(153, 27, 27, 0.2)', paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#991B1B' },
    logoutText: { color: '#F87171', fontSize: 14, fontWeight: '700', fontFamily: FONT_FAMILY_MEDIUM, letterSpacing: 1 },
    pickerPanel: { backgroundColor: '#0F172A', marginTop: 'auto', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderWidth: 1, borderColor: '#1E293B' },
    pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
    pickerTitle: { fontSize: 12, fontWeight: '800', fontFamily: FONT_FAMILY_BOLD, color: '#F1F5F9', letterSpacing: 1.5 },
    confirmButton: { backgroundColor: '#2563EB', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
    confirmButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', fontFamily: FONT_FAMILY_BOLD, letterSpacing: 2 },
    premiumInput: { backgroundColor: '#161B22', borderWidth: 1, borderColor: '#30363D', borderRadius: 16, padding: 18, color: '#F0F6FC', fontSize: 14, fontWeight: '600', fontFamily: FONT_FAMILY_REGULAR, marginBottom: 20 },
    groupActionsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    groupBtn: { flex: 1, backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#3B82F6' },
    groupBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', fontFamily: FONT_FAMILY_BOLD, letterSpacing: 1 },
    governanceEntryCard: { backgroundColor: '#0F172A', borderRadius: 20, padding: 24, marginTop: 10, borderWidth: 1, borderColor: 'rgba(34, 211, 238, 0.2)', overflow: 'hidden' },
    entryGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(34, 211, 238, 0.4)' },
    entryTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '800', fontFamily: FONT_FAMILY_BOLD, letterSpacing: 1, marginBottom: 4 },
    entryDesc: { color: '#64748B', fontSize: 12, fontFamily: FONT_FAMILY_REGULAR, lineHeight: 18 },
    entryArrow: { color: '#22D3EE', fontSize: 10, fontWeight: '900', fontFamily: FONT_FAMILY_BOLD, marginTop: 16, letterSpacing: 1 },
});
