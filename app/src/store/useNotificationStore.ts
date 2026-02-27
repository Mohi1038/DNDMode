import { create } from 'zustand';

export interface AppNotification {
    id: string;
    app: string;
    title: string;
    text: string;
    time: string;
}

interface NotificationState {
    notifications: AppNotification[];
    addNotification: (notif: AppNotification) => void;
    clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    addNotification: (notif) =>
        set((state) => ({
            notifications: [notif, ...state.notifications],
        })),
    clearNotifications: () => set({ notifications: [] }),
}));
