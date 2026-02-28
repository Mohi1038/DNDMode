import { Platform } from 'react-native';

/**
 * ChronoForge Global API Configuration
 *
 * Physical device: use the machine's LAN IP so the phone can reach the server.
 * Android Emulator: 10.0.2.2 points to your computer's localhost.
 * iOS Simulator: localhost works directly.
 */

// ⚡ Change this to your machine's current LAN IP (run `hostname -I` to find it)
const LAN_IP = '172.31.44.35';

export const API_CONFIG = {
    BASE_URL: Platform.select({
        android: `http://${LAN_IP}:5000`,
        ios: 'http://localhost:5000',
        default: 'http://localhost:5000',
    })!,
    TIMEOUT: 10000,
};

export const getApiBaseCandidates = (): string[] => {
    if (Platform.OS === 'android') {
        return [
            `http://${LAN_IP}:5000`,
            'http://10.0.2.2:5000',
            'http://localhost:5000',
        ];
    }

    return [API_CONFIG.BASE_URL, 'http://localhost:5000'];
};
