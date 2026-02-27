import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
    Animated, Modal, Platform, Alert, Easing, Vibration, ActivityIndicator
} from 'react-native';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { launchImageLibrary } from 'react-native-image-picker';
import { API_CONFIG } from '../config/apiConfig';
import FocusModeScreen from './FocusModeScreen';

// Helper for haptics
const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (Platform.OS === 'ios') {
        Vibration.vibrate(type === 'light' ? 10 : type === 'medium' ? 20 : 30);
    } else {
        Vibration.vibrate(type === 'light' ? 15 : type === 'medium' ? 25 : 40);
    }
};

export default function MainLandingPage() {
    const [showSettings, setShowSettings] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showOcrResult, setShowOcrResult] = useState(false);
    const [ocrData, setOcrData] = useState<any>(null);
    const [focusDuration, setFocusDuration] = useState(25);
    const [isFocusing, setIsFocusing] = useState(false);
    const [isLuminous, setIsLuminous] = useState(true); // Default to on for the vibe

    const { clearState } = useOnboardingStore();

    // Animations
    const entranceAnim = useRef(new Animated.Value(0)).current;
    const headerShimmerAnim = useRef(new Animated.Value(0)).current;
    const uploadBtnScale = useRef(new Animated.Value(1)).current;
    const focusBtnScale = useRef(new Animated.Value(1)).current;
    const ocrFadeAnim = useRef(new Animated.Value(0)).current;
    const luminousToggleAnim = useRef(new Animated.Value(1)).current; // 1 for active state

    useEffect(() => {
        // Page entrance animation
        Animated.timing(entranceAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();

        // Header text shimmer loop
        Animated.loop(
            Animated.sequence([
                Animated.timing(headerShimmerAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(headerShimmerAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.delay(4000)
            ])
        ).start();
    }, []);

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

        const result = await launchImageLibrary({
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

            const baseUrl = API_CONFIG.BASE_URL;
            const response = await fetch(`${baseUrl}/api/timetable/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'multipart/form-data' },
                body: formData,
            });

            const json = await response.json();
            if (response.ok) {
                setOcrData(json.data);
                triggerHaptic('medium');
                setShowOcrResult(true);
            } else {
                Alert.alert('Upload Failed', json.message || 'Error parsing timetable.');
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

    // Interpolations for entrance
    const translateY = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
    const opacity = entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

    return (
        <View style={styles.masterContainer}>
            {/* Simulated Deep Slate Gradient Background */}
            <View style={[styles.bgLayer, { backgroundColor: '#0F1115' }]} />
            <View style={[styles.bgLayer, { backgroundColor: '#141821', opacity: 0.7, top: '30%', bottom: '30%' }]} />
            <View style={[styles.bgLayer, { backgroundColor: '#0B0E13', opacity: 0.9, top: '60%' }]} />

            {/* Ambient vignette glow */}
            {isLuminous && <View style={styles.ambientGlow} />}

            <SafeAreaView style={styles.safeArea}>
                {/* Command Bar Header */}
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

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={{ opacity, transform: [{ translateY }] }}>

                        {/* AI Terminal Card (Timetable) */}
                        <View style={styles.glassCard}>
                            <View style={styles.cardHighlight} />
                            <View style={styles.cardHeaderRow}>
                                <Text style={styles.sectionTitle}>Classroom Timetable</Text>
                                <View style={styles.aiBadge}>
                                    <Text style={styles.aiBadgeText}>AI VISION</Text>
                                </View>
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

                            {/* Cyber Console JSON Block */}
                            {showOcrResult && (
                                <Animated.View style={[styles.cyberTerminal, { opacity: ocrFadeAnim }]}>
                                    <View style={styles.terminalHeader}>
                                        <Text style={styles.terminalTitle}>DATA.EXTRACTION_COMPLETE</Text>
                                        <TouchableOpacity onPress={() => { triggerHaptic('light'); setShowOcrResult(false); }}>
                                            <View style={styles.closeCircle}>
                                                <Text style={styles.closeCircleText}>✕</Text>
                                            </View>
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView style={styles.terminalScroll} nestedScrollEnabled={true}>
                                        <Text style={styles.terminalText}>
                                            {JSON.stringify(ocrData, null, 2)}
                                        </Text>
                                    </ScrollView>
                                </Animated.View>
                            )}
                        </View>

                        {/* Focus Time Boundaries Card */}
                        <View style={styles.glassCard}>
                            <View style={styles.cardHighlight} />
                            <Text style={styles.sectionTitle}>Execution Parameters</Text>
                            <Text style={styles.sectionSubtitle}>Select temporal duration and initialize deep focus protocol.</Text>

                            <View style={styles.timeSettingsRow}>
                                {[15, 25, 60].map(mins => {
                                    const isActive = focusDuration === mins;
                                    return (
                                        <TouchableOpacity
                                            key={mins}
                                            activeOpacity={0.8}
                                            style={[styles.timeChip, isActive && styles.timeChipActive]}
                                            onPress={() => { triggerHaptic('light'); setFocusDuration(mins); }}
                                        >
                                            <Text style={[styles.timeLabel, isActive && (isLuminous ? styles.timeLabelActive : { color: '#F8FAFC' })]}>{mins}</Text>
                                            <Text style={[styles.timeValue, isActive && (isLuminous ? styles.timeValueActive : { color: '#F1F5F9' })]}>MIN</Text>
                                            {isActive && isLuminous && <View style={styles.chipGlow} />}
                                        </TouchableOpacity>
                                    )
                                })}
                            </View>

                            <TouchableOpacity activeOpacity={1} onPress={handleStartFocus}>
                                <Animated.View style={[styles.heroButton, { transform: [{ scale: focusBtnScale }] }]}>
                                    <View style={styles.heroButtonBg} />
                                    <Text style={styles.heroButtonText}>INITIATE FOCUS</Text>
                                    {isLuminous && <View style={styles.heroGlow} />}
                                </Animated.View>
                            </TouchableOpacity>
                        </View>

                        {/* Study Groups Placeholder */}
                        <View style={[styles.glassCard, styles.lastCard]}>
                            <View style={styles.cardHighlight} />
                            <Text style={styles.sectionTitle}>Study Groups</Text>
                            <Text style={styles.sectionSubtitle}>Create or join a group to share timetables and align focus periods.</Text>

                            <TouchableOpacity style={styles.premiumPlaceholderButton} activeOpacity={0.9}>
                                <View style={styles.dashOutline} />
                                <Text style={styles.premiumPlaceholderText}>+ Create New Group (Coming Soon)</Text>
                            </TouchableOpacity>
                        </View>

                    </Animated.View>
                </ScrollView>
            </SafeAreaView>

            {/* AI Panel Settings Modal */}
            <Modal visible={showSettings} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.settingsPanel}>
                        <View style={styles.settingsHeader}>
                            <Text style={styles.settingsTitle}>SYSTEM CONFIG</Text>
                            <TouchableOpacity onPress={() => { triggerHaptic('light'); setShowSettings(false); }}>
                                <Text style={styles.closeText}>DONE</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.settingsItem}>
                            <Text style={styles.settingsItemText}>Luminous Interface</Text>
                            <TouchableOpacity activeOpacity={1} onPress={toggleLuminous}>
                                <View style={[styles.switchTrack, isLuminous && styles.switchTrackActive]}>
                                    <Animated.View style={[
                                        styles.switchKnob,
                                        {
                                            transform: [{
                                                translateX: luminousToggleAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [0, 20]
                                                })
                                            }]
                                        }
                                    ]} />
                                </View>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.settingsDivider} />

                        <TouchableOpacity activeOpacity={0.8} onPress={handleLogout}>
                            <View style={styles.logoutButton}>
                                <Text style={styles.logoutText}>TERMINATE SESSION</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Focus Mode Overlay */}
            <Modal visible={isFocusing} animationType="slide" presentationStyle="fullScreen">
                <FocusModeScreen
                    durationMinutes={focusDuration}
                    onEndFocus={() => setIsFocusing(false)}
                />
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    masterContainer: {
        flex: 1,
        backgroundColor: '#0F1115'
    },
    bgLayer: {
        position: 'absolute',
        top: 0, bottom: 0, left: 0, right: 0
    },
    ambientGlow: {
        position: 'absolute',
        top: '10%',
        left: '20%',
        right: '20%',
        height: '30%',
        backgroundColor: 'rgba(34, 211, 238, 0.05)',
        borderRadius: 200,
        transform: [{ scaleY: 1.5 }],
    },
    safeArea: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
        backgroundColor: 'rgba(15, 17, 21, 0.6)',
    },
    iconButton: {
        width: 44, height: 44,
        justifyContent: 'center', alignItems: 'flex-start',
    },
    hamburgerLine: {
        width: 22, height: 2,
        backgroundColor: '#94A3B8',
        marginVertical: 3, borderRadius: 1,
    },
    titleContainer: {
        justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18, fontWeight: '700',
        color: '#F8FAFC',
        letterSpacing: 1,
    },
    headerTitleGlow: {
        position: 'absolute',
        fontSize: 18, fontWeight: '700',
        color: '#22D3EE',
        letterSpacing: 1,
        textShadowColor: 'rgba(34, 211, 238, 0.8)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    scrollContent: {
        padding: 20,
    },
    glassCard: {
        backgroundColor: '#161B22',
        borderRadius: 24,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(34, 211, 238, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        overflow: 'hidden',
    },
    cardHighlight: {
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    lastCard: { marginBottom: 40 },
    cardHeaderRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
    },
    sectionTitle: {
        fontSize: 18, fontWeight: '700', color: '#F1F5F9', letterSpacing: 0.5,
    },
    aiBadge: {
        backgroundColor: 'rgba(34, 211, 238, 0.1)',
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
        borderWidth: 1, borderColor: 'rgba(34, 211, 238, 0.3)',
    },
    aiBadgeText: {
        color: '#22D3EE', fontSize: 10, fontWeight: '800', letterSpacing: 1,
    },
    sectionSubtitle: {
        fontSize: 13, color: '#94A3B8', lineHeight: 20, marginBottom: 24,
    },
    uploadButton: {
        backgroundColor: '#1E293B',
        paddingVertical: 16, borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1, borderColor: '#334155',
        overflow: 'hidden',
    },
    buttonNeonEdge: {
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        backgroundColor: 'rgba(37, 99, 235, 0.5)',
    },
    uploadButtonText: { color: '#E2E8F0', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
    uploadButtonTextActive: { color: '#22D3EE', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
    cyberTerminal: {
        marginTop: 20,
        backgroundColor: '#0F172A',
        borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(34, 211, 238, 0.2)',
        overflow: 'hidden',
    },
    terminalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#1E293B', paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: 1, borderBottomColor: '#334155',
    },
    terminalTitle: {
        color: '#10B981', fontSize: 11, fontWeight: '700', letterSpacing: 1,
        textShadowColor: 'rgba(16, 185, 129, 0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
    },
    closeCircle: {
        width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.05)',
        justifyContent: 'center', alignItems: 'center',
    },
    closeCircleText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
    terminalScroll: { maxHeight: 200, padding: 16 },
    terminalText: {
        color: '#38BDF8', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 18,
    },
    timeSettingsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    timeChip: {
        flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', borderRadius: 16, padding: 16,
        alignItems: 'center', borderWidth: 1, borderColor: '#334155', marginHorizontal: 4,
    },
    timeChipActive: {
        backgroundColor: 'rgba(37, 99, 235, 0.15)', borderColor: '#2563EB',
    },
    chipGlow: {
        position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
        borderRadius: 16, borderWidth: 1, borderColor: '#38BDF8', opacity: 0.4,
    },
    timeLabel: { fontSize: 24, fontWeight: '800', color: '#64748B', marginBottom: 2 },
    timeLabelActive: {
        color: '#F8FAFC', textShadowColor: '#38BDF8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10,
    },
    timeValue: { fontSize: 11, fontWeight: '700', color: '#475569', letterSpacing: 1 },
    timeValueActive: { color: '#38BDF8' },
    heroButton: {
        height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
        backgroundColor: '#2563EB', // Base electric blue
        overflow: 'hidden',
    },
    heroButtonBg: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.1)', // Simulating a metallic surface gradient
    },
    heroGlow: {
        position: 'absolute', top: -10, left: '20%', right: '20%', height: 20,
        backgroundColor: '#60A5FA', opacity: 0.8, borderRadius: 20,
        shadowColor: '#60A5FA', shadowOffset: { width: 0, height: 0 }, shadowRadius: 10, shadowOpacity: 1,
    },
    heroButtonText: {
        color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 1.5,
    },
    premiumPlaceholderButton: {
        height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
    },
    dashOutline: {
        position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
        borderRadius: 16, borderWidth: 1, borderColor: '#38BDF8', borderStyle: 'dashed', opacity: 0.3,
    },
    premiumPlaceholderText: { color: '#64748B', fontSize: 15, fontWeight: '600', letterSpacing: 0.5 },
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-start',
    },
    settingsPanel: {
        backgroundColor: '#1E293B',
        marginTop: Platform.OS === 'ios' ? 60 : 40,
        marginHorizontal: 16, borderRadius: 24, padding: 24,
        borderWidth: 1, borderColor: '#334155',
        shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.5, shadowRadius: 30, elevation: 15,
    },
    settingsHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24,
    },
    settingsTitle: { fontSize: 14, fontWeight: '800', color: '#F1F5F9', letterSpacing: 2 },
    closeText: { fontSize: 12, color: '#94A3B8', fontWeight: '700', letterSpacing: 1 },
    settingsItem: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12,
    },
    settingsItemText: { fontSize: 15, color: '#CBD5E1', fontWeight: '500' },
    dummyToggle: {
        width: 44, height: 24, borderRadius: 12, backgroundColor: '#334155', padding: 2,
    },
    dummyToggleKnob: {
        width: 20, height: 20, borderRadius: 10, backgroundColor: '#94A3B8',
    },
    switchTrack: {
        width: 44, height: 24, borderRadius: 12, backgroundColor: '#334155', padding: 2,
        justifyContent: 'center',
    },
    switchTrackActive: {
        backgroundColor: '#2563EB',
    },
    switchKnob: {
        width: 20, height: 20, borderRadius: 10, backgroundColor: '#F8FAFC',
        shadowColor: '#38BDF8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 5,
    },
    settingsDivider: { height: 1, backgroundColor: '#334155', marginVertical: 16 },
    logoutButton: {
        backgroundColor: 'rgba(153, 27, 27, 0.2)', paddingVertical: 14, borderRadius: 16,
        alignItems: 'center', borderWidth: 1, borderColor: '#991B1B',
    },
    logoutText: { color: '#F87171', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
});
