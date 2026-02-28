// In-memory notification store
const notifications = [];

const MAX_NOTIFICATIONS = 500;

const addNotification = (notification) => {
    const entry = {
        ...notification,
        receivedAt: new Date().toISOString(),
    };
    notifications.unshift(entry);

    if (notifications.length > MAX_NOTIFICATIONS) {
        notifications.length = MAX_NOTIFICATIONS;
    }

    return entry;
};

const getAllNotifications = () => notifications;

const getLatestNotification = () => notifications[0] || null;

const clearNotifications = () => {
    notifications.length = 0;
};

const getCount = () => notifications.length;

module.exports = {
    addNotification,
    getAllNotifications,
    getLatestNotification,
    clearNotifications,
    getCount,
};
