import { Platform } from 'react-native';

/**
 * ChronoForge Global API Configuration
 *
 * Physical device: use the machine's LAN IP so the phone can reach the server.
 * Android Emulator: 10.0.2.2 points to your computer's 172.31.44.35.
 * iOS Simulator: 172.31.44.35 works directly.
 */

const LAN_IP = '172.31.44.35';

export const API_CONFIG = {
    BASE_URL: Platform.select({
        android: 'http://172.31.44.35:5000',
        ios: 'http://172.31.44.35:5000',
        default: 'http://172.31.44.35:5000',
    })!,
    TIMEOUT: 10000,
};

export const getApiBaseCandidates = (): string[] => {
    if (Platform.OS === 'android') {
        return [
            'http://172.31.44.35:5000',
            `http://${LAN_IP}:5000`,
            'http://10.0.2.2:5000',
            `http://${LAN_IP}:5000`,
            'http://10.0.2.2:5000',
            'http://172.31.44.35:5000',
        ];
    }

    return [API_CONFIG.BASE_URL, 'http://172.31.44.35:5000', 'http://172.31.44.35:5000'];
};
