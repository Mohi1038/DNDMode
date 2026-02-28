import { NativeModules } from 'react-native';
import { API_CONFIG } from '../config/apiConfig';

const { DigitalWellbeingModule } = NativeModules;

interface UsageStat {
    packageName: string;
    appName: string;
    totalTimeInForeground: number;
    lastTimeUsed: number;
    launches: number;
}

class DigitalWellbeingService {
    async hasPermission(): Promise<boolean> {
        return await DigitalWellbeingModule.hasPermission();
    }

    openUsageAccessSettings(): void {
        DigitalWellbeingModule.openUsageAccessSettings();
    }

    async getTodayUsageStats(): Promise<UsageStat[]> {
        try {
            const stats = await DigitalWellbeingModule.getTodayUsageStats();
            return stats as UsageStat[];
        } catch (error) {
            console.error('[DigitalWellbeing] Failed to get stats:', error);
            return [];
        }
    }

    async sendUsageStatsToBackend(): Promise<void> {
        try {
            const stats = await this.getTodayUsageStats();

            if (stats.length === 0) {
                console.log('[DigitalWellbeing] No usage stats to send');
                return;
            }

            const response = await fetch(`${API_CONFIG.BASE_URL}/api/digital-wellbeing/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usageStats: stats }),
            });

            const data = await response.json();
            console.log('[DigitalWellbeing] Sent to backend:', data.status);
        } catch (error) {
            console.error('[DigitalWellbeing] Send failed:', error);
        }
    }
}

export const digitalWellbeingService = new DigitalWellbeingService();
