/**
 * React Native wrapper for the AppTimerModule native module.
 *
 * Provides typed functions for managing per-app daily usage timers.
 * The native side monitors usage via UsageStatsManager and blocks apps
 * through the accessibility service when limits are exceeded.
 */
import { NativeModules } from 'react-native';

const { AppTimerModule } = NativeModules;

export interface AppTimerInfo {
    packageName: string;
    limitMinutes: number;
    usedMinutes: number;
    remainingMinutes: number;
    isBlocked: boolean;
}

/**
 * Check if Usage Access permission is granted.
 */
export const hasUsagePermission = (): Promise<boolean> =>
    AppTimerModule.hasUsagePermission();

/**
 * Open system settings so the user can grant Usage Access permission.
 */
export const openUsageAccessSettings = (): Promise<boolean> =>
    AppTimerModule.openUsageAccessSettings();

/**
 * Set a daily usage timer for an app. Starts the monitoring service automatically.
 * Will reject with PERMISSION_DENIED if Usage Access is not granted.
 * @param packageName - Android package name (e.g. "com.instagram.android")
 * @param limitMinutes - Daily limit in minutes
 */
export const setAppTimer = (packageName: string, limitMinutes: number): Promise<boolean> =>
    AppTimerModule.setAppTimer(packageName, limitMinutes);

/**
 * Remove a timer for an app and unblock it immediately.
 */
export const removeAppTimer = (packageName: string): Promise<boolean> =>
    AppTimerModule.removeAppTimer(packageName);

/**
 * Update remaining time from WebSocket push event. 
 * If remainingSeconds <= 0, the native module will block the app.
 * If > 0, it unblocks the app.
 */
export const updateRemainingTime = (packageName: string, remainingSeconds: number): Promise<boolean> =>
    AppTimerModule.updateRemainingTime(packageName, remainingSeconds);

/**
 * Get all active timers with current usage, remaining time, and blocked status.
 */
export const getAppTimers = (): Promise<AppTimerInfo[]> =>
    AppTimerModule.getAppTimers();

/**
 * Explicitly start the background monitoring foreground service.
 */
export const startTimerService = (): Promise<boolean> =>
    AppTimerModule.startTimerService();

/**
 * Stop the background monitoring service.
 */
export const stopTimerService = (): Promise<boolean> =>
    AppTimerModule.stopTimerService();
