import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';

export default function SplashScreen() {
    const logoScale = useRef(new Animated.Value(0.9)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(logoOpacity, {
                toValue: 1,
                duration: 500,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(logoScale, {
                toValue: 1,
                duration: 700,
                easing: Easing.out(Easing.back(1.1)),
                useNativeDriver: true,
            }),
        ]).start();
    }, [logoOpacity, logoScale]);

    return (
        <View style={styles.container}>
            <Animated.Image
                source={require('../assets/chronoforge-logo.png')}
                style={[
                    styles.logo,
                    {
                        opacity: logoOpacity,
                        transform: [{ scale: logoScale }],
                    },
                ]}
                resizeMode="contain"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F1115',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    logo: {
        width: 520,
        height: 520,
    },
});
