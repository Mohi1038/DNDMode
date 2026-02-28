import { NativeModules } from 'react-native';

const { FocusModeModule } = NativeModules;

class FocusModeService {
    async startFocusMode(): Promise<void> {
        FocusModeModule.startFocusMode();
        console.log('[FocusModeService] Focus mode started');
    }

    async stopFocusMode(): Promise<void> {
        FocusModeModule.stopFocusMode();
        console.log('[FocusModeService] Focus mode stopped');
    }

    async isActive(): Promise<boolean> {
        return await FocusModeModule.isFocusModeActive();
    }

    async isAccessibilityEnabled(): Promise<boolean> {
        return await FocusModeModule.isAccessibilityEnabled();
    }

    async isDndPermissionGranted(): Promise<boolean> {
        return await FocusModeModule.isDndPermissionGranted();
    }

    openAccessibilitySettings(): void {
        FocusModeModule.openAccessibilitySettings();
    }

    openDndSettings(): void {
        FocusModeModule.openDndSettings();
    }
}

export const focusModeService = new FocusModeService();
