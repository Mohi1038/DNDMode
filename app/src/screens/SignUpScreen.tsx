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
    ScrollView,
    Image,
} from 'react-native';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { API_CONFIG } from '../config/apiConfig';

interface SignUpScreenProps {
    onBackToLogin: () => void;
}

const SignUpScreen = ({ onBackToLogin }: SignUpScreenProps) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const setTempAuth = useOnboardingStore((state) => state.setTempAuth);

    const handleSignUp = async () => {
        if (!name || !email || !password || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields.');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${API_CONFIG.BASE_URL}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });
            const data = await res.json();

            if (res.ok) {
                setTempAuth(data.tempToken, email);
            } else {
                Alert.alert('Sign-up failed', data.message || 'Error creating account');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not connect to the backend server.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.keyboardAvoiding}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <View style={styles.container}>
                        <View style={styles.header}>
                            <Image
                                source={require('../assets/logo2.png')}
                                style={styles.brandLogo}
                                resizeMode="contain"
                            />
                            <Text style={styles.title}>Create Account</Text>
                            <Text style={styles.subtitle}>Join ChronoForge to establish deep focus</Text>
                        </View>

                        <View style={styles.form}>
                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Full Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter your name"
                                    placeholderTextColor="#9CA3AF"
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>

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
                                    placeholder="Create a password"
                                    placeholderTextColor="#9CA3AF"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.label}>Confirm Password</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirm your password"
                                    placeholderTextColor="#9CA3AF"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.signupButton, isLoading && styles.disabledButton]}
                                onPress={handleSignUp}
                                disabled={isLoading}
                            >
                                <Text style={styles.signupButtonText}>
                                    {isLoading ? 'Creating Account...' : 'Sign Up'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Already have an account? </Text>
                            <TouchableOpacity onPress={onBackToLogin}>
                                <Text style={styles.loginText}>Log In</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
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
    scrollContainer: {
        flexGrow: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: 24,
        paddingVertical: 40,
        justifyContent: 'center',
    },
    header: {
        marginBottom: 24,
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
        marginBottom: 16,
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
    signupButton: {
        backgroundColor: '#5E6D80',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 24,
    },
    disabledButton: {
        opacity: 0.7,
    },
    signupButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
    },
    footerText: {
        color: '#9EABBB',
        fontSize: 14,
    },
    loginText: {
        color: '#C3CEDB',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default SignUpScreen;
