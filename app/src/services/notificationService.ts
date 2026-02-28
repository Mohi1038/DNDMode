const SERVER_URL = 'http://172.31.44.35:5000';

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
            const response = await fetch(`${SERVER_URL}/notifications/ingest`, {
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
