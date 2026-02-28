import { Platform, Vibration } from 'react-native';

export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (Platform.OS === 'ios') {
        Vibration.vibrate(type === 'light' ? 10 : type === 'medium' ? 20 : 30);
    } else {
        Vibration.vibrate(type === 'light' ? 15 : type === 'medium' ? 25 : 40);
    }
};
