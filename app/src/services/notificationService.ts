import { API_CONFIG } from '../config/apiConfig';

interface NotificationData {
    packageName: string;
    appName: string;
    title: string;
    text: string;
    time: number;
    notificationId: number;
    isOngoing: boolean;
}

class NotificationService {
    async ingest(notification: NotificationData): Promise<void> {
        try {
            const response = await fetch(`${API_CONFIG.BASE_URL}/notifications/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notification),
            });

            const data = await response.json();
            console.log('[NotificationService] Ingested:', data.status);
        } catch (error) {
            console.error('[NotificationService] Ingest failed:', error);
        }
    }
}

export const notificationService = new NotificationService();
