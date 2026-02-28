import React, { useState } from 'react';
import {
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
    Image,
} from 'react-native';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { API_CONFIG, getApiBaseCandidates } from '../config/apiConfig';

interface LoginScreenProps {
    onSignUpPress: () => void;
}

const LoginScreen = ({ onSignUpPress }: LoginScreenProps) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const setTempAuth = useOnboardingStore((state) => state.setTempAuth);

    const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 3500) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(url, { ...options, signal: controller.signal });
        } finally {
            clearTimeout(timeoutId);
        }
    };

    const handleLogin = async () => {
        if (isLoggingIn) {
            return;
        }

        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password.');
            return;
        }

        setIsLoggingIn(true);

        const candidates = [API_CONFIG.BASE_URL, ...getApiBaseCandidates()]
            .filter((url, index, arr) => arr.indexOf(url) === index);

        let lastNetworkError: unknown = null;

        for (const baseUrl of candidates) {
            try {
                const res = await fetchWithTimeout(
                    `${baseUrl}/api/auth/verify-initial`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password }),
                    },
                    3500
                );

                const data = await res.json();

                if (res.ok) {
                    setTempAuth(data.tempToken, email);
                    setIsLoggingIn(false);
                    return;
                }

                Alert.alert('Login failed', data.message || 'Verification failed');
                setIsLoggingIn(false);
                return;
            } catch (error) {
                lastNetworkError = error;
            }
        }

        console.warn('Login network attempts failed:', lastNetworkError);
        Alert.alert('Error', 'Could not connect to the backend server.');
        setIsLoggingIn(false);
    };

    const handleGoogleLogin = () => {
        console.log('Google login pressed');
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoiding}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Image
                            source={require('../assets/logo2.png')}
                            style={styles.brandLogo}
                            resizeMode="contain"
                        />
                        <Text style={styles.title}>Welcome Back</Text>
                        <Text style={styles.subtitle}>Sign in to continue to ChronoForge</Text>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your email"
                                placeholderTextColor="#9CA3AF"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your password"
                                placeholderTextColor="#9CA3AF"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity style={styles.forgotPassword}>
                            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.loginButton, isLoggingIn && styles.loginButtonDisabled]}
                            onPress={handleLogin}
                            disabled={isLoggingIn}
                        >
                            {isLoggingIn ? (
                                <View style={styles.loginButtonLoadingRow}>
                                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                                    <Text style={styles.loginButtonText}>Logging in...</Text>
                                </View>
                            ) : (
                                <Text style={styles.loginButtonText}>Log In</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.dividerContainer}>
                            <View style={styles.divider} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.divider} />
                        </View>

                        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
                            <Text style={styles.googleButtonText}>Continue with Google</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Don't have an account? </Text>
                        <TouchableOpacity onPress={onSignUpPress}>
                            <Text style={styles.signupText}>Sign up</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#202730',
    },
    keyboardAvoiding: {
        flex: 1,
        backgroundColor: '#1A2028',
    },
    container: {
        flex: 1,
        paddingHorizontal: 24,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 28,
        alignItems: 'center',
    },
    brandLogo: {
        width: 160,
        height: 160,
        marginBottom: 12,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#E6ECF3',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#AAB6C4',
        textAlign: 'center',
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#C5CFDB',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#2A323C',
        borderWidth: 1,
        borderColor: '#465463',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#E8EEF6',
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 24,
    },
    forgotPasswordText: {
        color: '#B8C4D3',
        fontSize: 14,
        fontWeight: '600',
    },
    loginButton: {
        backgroundColor: '#5E6D80',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 24,
    },
    loginButtonDisabled: {
        opacity: 0.85,
    },
    loginButtonLoadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: '#4A5868',
    },
    dividerText: {
        marginHorizontal: 16,
        color: '#8A97A8',
        fontSize: 14,
        fontWeight: '500',
    },
    googleButton: {
        backgroundColor: '#252D37',
        borderWidth: 1,
        borderColor: '#465463',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    googleButtonText: {
        color: '#D5DEE9',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 40,
    },
    footerText: {
        color: '#9EABBB',
        fontSize: 14,
    },
    signupText: {
        color: '#C3CEDB',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default LoginScreen;
