import { NativeModules, Platform } from 'react-native';

const readServerUrlFromEnv = (): string | undefined => {
    const fromNative = NativeModules?.NotificationModule?.SERVER_URL;
    const fromProcess = process?.env?.SERVER_URL;
    const raw = fromNative || fromProcess;

    if (typeof raw !== 'string') {
        return undefined;
    }

    const value = raw.trim().replace(/^['\"]|['\"]$/g, '').replace(/\/$/, '');
    return value.length > 0 ? value : undefined;
};

const DEFAULT_BASE_URL = Platform.select({
    android: 'http://10.0.2.2:5000',
    ios: 'http://localhost:5000',
    default: 'http://localhost:5000',
})!;

const RESOLVED_SERVER_URL = readServerUrlFromEnv() || DEFAULT_BASE_URL;

export const API_CONFIG = {
    BASE_URL: RESOLVED_SERVER_URL,
    TIMEOUT: 10000,
};

export const getApiBaseCandidates = (): string[] => {
    const candidates = [API_CONFIG.BASE_URL];

    if (Platform.OS === 'android') {
        candidates.push('http://10.0.2.2:5000');
    }

    candidates.push('http://localhost:5000');
    return Array.from(new Set(candidates));
};
