import { Platform } from 'react-native';

/**
 * ChronoForge Global API Configuration
 *
 * Android Emulator: 10.0.2.2 points to your computer's localhost.
 * iOS Simulator: localhost works directly.
 *
 * For a physical device, replace with your machine LAN IP (e.g. http://192.168.1.10:5000).
 */
export const API_CONFIG = {
    BASE_URL: Platform.select({
        android: 'http://10.0.2.2:5001',
        ios: 'http://localhost:5001',
        default: 'http://localhost:5001',
    })!,
    TIMEOUT: 10000,
};

export const getApiBaseCandidates = (): string[] => {
    if (Platform.OS === 'android') {
        return [
            'http://localhost:5001',
            'http://10.0.2.2:5001',
            'http://10.0.2.2:5000',
            'http://localhost:5000',
        ];
    }

    return [API_CONFIG.BASE_URL, 'http://localhost:5000'];
};
