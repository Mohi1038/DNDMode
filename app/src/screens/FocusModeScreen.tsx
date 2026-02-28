import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
    Animated, Easing, Vibration, Platform
} from 'react-native';

interface FocusModeScreenProps {
    durationMinutes: number;
    participants?: string[];
    onEndFocus: () => void;
}

// Minimal Haptic Feedback helper
const triggerHaptic = () => {
    if (Platform.OS === 'ios') {
        // Simple vibration pattern for micro-haptic
        Vibration.vibrate(10);
    } else {
        Vibration.vibrate(20);
    }
};

export default function FocusModeScreen({ durationMinutes, participants = [], onEndFocus }: FocusModeScreenProps) {
    const [timeLeftRemaining, setTimeLeftRemaining] = useState(durationMinutes * 60);
    const [isListening, setIsListening] = useState(false);

    // Core Animations
    const timerGlowAnim = useRef(new Animated.Value(1)).current;
    const pulseAnim1 = useRef(new Animated.Value(1)).current;
    const pulseAnim2 = useRef(new Animated.Value(1)).current;
    const rainbowRotAnim = useRef(new Animated.Value(0)).current;
    const buttonScaleAnim = useRef(new Animated.Value(1)).current;
    const textFadeAnim = useRef(new Animated.Value(1)).current;
    const textSlideAnim = useRef(new Animated.Value(0)).current;

    // Timer Logic
    useEffect(() => {
        const interval = setInterval(() => {
            setTimeLeftRemaining((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    triggerHaptic();
                    // Cinematic fade out before ending
                    setTimeout(() => onEndFocus(), 1000);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        // Subtle timer breathing glow
        Animated.loop(
            Animated.sequence([
                Animated.timing(timerGlowAnim, { toValue: 1.2, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(timerGlowAnim, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
            ])
        ).start();

        // Continuous slow rotation for the gradient ring
        Animated.loop(
            Animated.timing(rainbowRotAnim, {
                toValue: 1,
                duration: 6000,
                easing: Easing.linear,
                useNativeDriver: true
            })
        ).start();

        return () => clearInterval(interval);
    }, [onEndFocus]);

    // Listening State Animations
    useEffect(() => {
        if (isListening) {
            // Text transition animation: fade out, slide up, change text, fade in
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(textFadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
                    Animated.timing(textSlideAnim, { toValue: -10, duration: 150, useNativeDriver: true }),
                ]),
                Animated.parallel([
                    Animated.timing(textFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
                    Animated.timing(textSlideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                ])
            ]).start();

            // Intense pulsing for voice active
            Animated.loop(
                Animated.parallel([
                    Animated.sequence([
                        Animated.timing(pulseAnim1, { toValue: 1.8, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                        Animated.timing(pulseAnim1, { toValue: 1, duration: 0, useNativeDriver: true })
                    ]),
                    Animated.sequence([
                        Animated.delay(400),
                        Animated.timing(pulseAnim2, { toValue: 1.8, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                        Animated.timing(pulseAnim2, { toValue: 1, duration: 0, useNativeDriver: true })
                    ])
                ])
            ).start();

            // Auto-stop after 5 seconds
            const timeout = setTimeout(() => {
                handleStopListening();
            }, 5000);
            return () => clearTimeout(timeout);
        } else {
            // Text transition back
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(textFadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
                    Animated.timing(textSlideAnim, { toValue: 10, duration: 150, useNativeDriver: true }),
                ]),
                Animated.parallel([
                    Animated.timing(textFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
                    Animated.timing(textSlideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
                ])
            ]).start();

            // Reset pulse animations smoothly
            Animated.parallel([
                Animated.timing(pulseAnim1, { toValue: 1, duration: 300, useNativeDriver: true }),
                Animated.timing(pulseAnim2, { toValue: 1, duration: 300, useNativeDriver: true }),
            ]).start();
        }
    }, [isListening]);

    const handleStopListening = () => {
        setIsListening(false);
        triggerHaptic();
    };

    const handleToggleVoiceIn = () => {
        triggerHaptic();
        Animated.timing(buttonScaleAnim, {
            toValue: 0.9,
            duration: 100,
            useNativeDriver: true,
            easing: Easing.out(Easing.quad)
        }).start();
    };

    const handleToggleVoiceOut = () => {
        setIsListening(!isListening);
        Animated.spring(buttonScaleAnim, {
            toValue: 1,
            friction: 4,
            tension: 40,
            useNativeDriver: true
        }).start();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Interpolate rotation for the ring
    const spin = rainbowRotAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    // Interpolate status color
    const statusColor = isListening ? '#38BDF8' : (timeLeftRemaining === 0 ? '#10B981' : '#94A3B8');

    return (
        <SafeAreaView style={styles.container}>
            {/* Ambient Background Glow (Simulated Vignette/Bloom) */}
            <View style={styles.ambientGlow} />

            {/* Header: End Early Chip */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => { triggerHaptic(); onEndFocus(); }}
                    style={styles.endButton}
                    activeOpacity={0.6}
                >
                    <Text style={styles.endButtonText}>End Early</Text>
                </TouchableOpacity>
            </View>

            {/* Timer Hero Section */}
            <View style={styles.timerContainer}>
                <View style={styles.timerWrapper}>
                    {/* Timer text glow shadow effect layered behind */}
                    <Animated.Text style={[styles.timerTextGlow, { opacity: timerGlowAnim }]}>
                        {formatTime(timeLeftRemaining)}
                    </Animated.Text>
                    <Text style={styles.timerText}>{formatTime(timeLeftRemaining)}</Text>
                </View>

                <Text style={[styles.statusLabel, { color: statusColor, textShadowColor: statusColor }]}>
                    {timeLeftRemaining === 0 ? "SESSION COMPLETE" : "DEEP FOCUS ACTIVE"}
                </Text>

                {participants.length > 0 && (
                    <View style={styles.syncContainer}>
                        <View style={styles.syncPulse} />
                        <Text style={styles.syncText}>
                            SYNCHRONIZED WITH: {participants.join(', ').toUpperCase()}
                        </Text>
                    </View>
                )}
            </View>

            {/* Control Dock (Frosted / Slate Metal feel) */}
            <View style={styles.dockContainer}>
                {/* Highlight edge line simulating metallic rim */}
                <View style={styles.dockHighlight} />

                {/* Transcription Box */}
                <View style={styles.transcriptionBox}>
                    <Animated.View style={{ opacity: textFadeAnim, transform: [{ translateY: textSlideAnim }] }}>
                        <Text style={[styles.transcriptionText, isListening && styles.transcriptionTextActive]}>
                            {isListening ? "Listening..." : "Assistant is standing by."}
                        </Text>
                    </Animated.View>
                </View>

                {/* Voice Orb Area */}
                <View style={styles.voiceOrbWrapper}>
                    {/* Pulsing Sensing Waves */}
                    <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim2 }], opacity: isListening ? 0.15 : 0 }]} />
                    <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim1 }], opacity: isListening ? 0.3 : 0 }]} />

                    {/* Rotating "Rainbow" Ring Simulator using layered borders */}
                    {isListening && (
                        <Animated.View style={[styles.rainbowRingOuter, { transform: [{ rotate: spin }] }]}>
                            <View style={styles.rainbowRingInner1} />
                            <View style={styles.rainbowRingInner2} />
                        </Animated.View>
                    )}

                    {/* Central Button */}
                    <TouchableOpacity
                        activeOpacity={1}
                        onPressIn={handleToggleVoiceIn}
                        onPressOut={handleToggleVoiceOut}
                    >
                        <Animated.View style={[
                            styles.voiceOrb,
                            isListening && styles.voiceOrbActive,
                            { transform: [{ scale: buttonScaleAnim }] }
                        ]}>
                            <Text style={styles.voiceOrbIcon}>{isListening ? "⏹" : "🎤"}</Text>
                        </Animated.View>
                    </TouchableOpacity>
                </View>

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A0C10', // Deepest slate charcoal
    },
    ambientGlow: {
        position: 'absolute',
        top: '20%',
        left: '10%',
        right: '10%',
        height: '40%',
        backgroundColor: 'rgba(56, 189, 248, 0.03)',
        borderRadius: 200,
        transform: [{ scaleY: 2 }],
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 10,
        zIndex: 10,
    },
    endButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    endButtonText: {
        color: '#94A3B8',
        fontWeight: '600',
        fontSize: 14,
        letterSpacing: 0.5,
    },
    timerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerText: {
        fontSize: 90,
        fontWeight: '300',
        color: '#F8FAFC',
        fontVariant: ['tabular-nums'],
        letterSpacing: -2,
        includeFontPadding: false,
    },
    timerTextGlow: {
        position: 'absolute',
        fontSize: 90,
        fontWeight: '300',
        color: '#F8FAFC',
        fontVariant: ['tabular-nums'],
        letterSpacing: -2,
        includeFontPadding: false,
        textShadowColor: 'rgba(255, 255, 255, 0.4)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 40,
    },
    statusLabel: {
        fontSize: 16,
        marginTop: 16,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 4,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    dockContainer: {
        // height proportion
        height: 380,
        backgroundColor: '#13171F', // Slightly lighter frosted slate
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 40,
        paddingHorizontal: 24,
        // Elevation/Shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.4,
        shadowRadius: 30,
        elevation: 20,
    },
    dockHighlight: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderTopLeftRadius: 40,
        borderTopRightRadius: 40,
    },
    transcriptionBox: {
        width: '100%',
        minHeight: 80,
        padding: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.2)', // Inside inset look
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginBottom: 40,
    },
    transcriptionText: {
        color: '#64748B',
        fontSize: 18,
        textAlign: 'center',
        lineHeight: 28,
        fontWeight: '400',
    },
    transcriptionTextActive: {
        color: '#E2E8F0',
        fontStyle: 'italic',
        fontWeight: '500',
    },
    voiceOrbWrapper: {
        width: 140,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pulseRing: {
        position: 'absolute',
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: '#38BDF8', // Cyan
    },
    rainbowRingOuter: {
        position: 'absolute',
        width: 106,
        height: 106,
        borderRadius: 53,
        borderWidth: 3,
        borderColor: '#EF4444', // Red base
        borderTopColor: '#F59E0B', // Yellow
        borderLeftColor: '#10B981', // Green
        borderRightColor: '#6366F1', // Indigo
        zIndex: 5,
        opacity: 0.8,
        shadowColor: '#38BDF8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
    },
    rainbowRingInner1: { // Fake radial overlay
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 53,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.2)'
    },
    rainbowRingInner2: { // Fake radial overlay
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 53,
        borderWidth: 2,
        borderColor: 'rgba(0, 0, 0, 0.2)',
        transform: [{ rotate: '45deg' }]
    },
    voiceOrb: {
        width: 90,
        height: 90,
        borderRadius: 45,
        // Metallic steel look
        backgroundColor: '#1E293B',
        borderWidth: 2,
        borderColor: '#334155',
        justifyContent: 'center',
        alignItems: 'center',
        // Inner shadow and outer glow simulation
        shadowColor: '#38BDF8', // Cool electric blue idle
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 10,
        zIndex: 10,
    },
    voiceOrbActive: {
        backgroundColor: '#2A1010', // Deep dark red metallic
        borderColor: '#7F1D1D',
        shadowColor: '#EF4444', // Alert red
        shadowOpacity: 0.6,
        shadowRadius: 20,
    },
    voiceOrbIcon: {
        fontSize: 28,
        color: '#E2E8F0',
        textShadowColor: 'rgba(255, 255, 255, 0.5)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
        opacity: 0.9,
    },
    syncContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 24,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: 'rgba(34, 211, 238, 0.05)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(34, 211, 238, 0.1)',
    },
    syncPulse: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22D3EE',
        marginRight: 10,
        shadowColor: '#22D3EE',
        shadowRadius: 6,
        shadowOpacity: 0.8,
    },
    syncText: {
        color: '#22D3EE',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1,
    },
});
