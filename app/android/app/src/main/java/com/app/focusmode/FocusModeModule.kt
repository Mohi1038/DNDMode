package com.app.focusmode

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class FocusModeModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {

    companion object {
        private const val TAG = "FocusModeModule"
    }

    override fun getName(): String = "FocusModeModule"

    // ─── Legacy non-promise methods (backward compat) ───────────────────

    @ReactMethod
    fun startFocusMode() {
        FocusModeManager.startFocusMode()
        muteNotificationSounds(true)
        Log.d(TAG, "Focus Mode started")
    }

    @ReactMethod
    fun stopFocusMode() {
        FocusModeManager.stopFocusMode()
        muteNotificationSounds(false)
        Log.d(TAG, "Focus Mode stopped")
    }

    // ─── Promise-based methods for React Native async/await ─────────────

    @ReactMethod
    fun startFocusSession(promise: Promise) {
        try {
            clearAnyLegacyDnd()
            FocusModeManager.startFocusMode()
            muteNotificationSounds(true)
            Log.d(TAG, "Focus Session started — isActive=${FocusModeManager.isActive}")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start focus session: ${e.message}", e)
            promise.reject("START_FOCUS_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun stopFocusSession(promise: Promise) {
        try {
            FocusModeManager.stopFocusMode()
            muteNotificationSounds(false)
            clearAnyLegacyDnd()
            Log.d(TAG, "Focus Session stopped — isActive=${FocusModeManager.isActive}")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop focus session: ${e.message}", e)
            promise.reject("STOP_FOCUS_FAILED", e.message, e)
        }
    }

    // ─── Status checks ──────────────────────────────────────────────────

    @ReactMethod
    fun isFocusModeActive(promise: Promise) {
        promise.resolve(FocusModeManager.isActive)
    }

    /**
     * Checks if the Accessibility Service is enabled using BOTH:
     * 1. The runtime isRunning flag (set by AppBlockerService.onServiceConnected)
     * 2. A system-level Settings.Secure check (survives app restarts)
     */
    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        val enabled = AppBlockerService.isRunning || isAccessibilityServiceEnabledInSettings()
        Log.d(TAG, "isAccessibilityEnabled: isRunning=${AppBlockerService.isRunning}, settingsCheck=${isAccessibilityServiceEnabledInSettings()}")
        promise.resolve(enabled)
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    // ─── Notification Sound Muting (NO DND — just AudioManager) ─────────

    private var savedNotificationVolume = -1
    private var savedRingerMode = -1

    /**
     * Mutes/unmutes notification sounds using AudioManager.
     * Does NOT enable DND — just sets STREAM_NOTIFICATION volume to 0.
     * Calls still ring normally (STREAM_RING is untouched).
     */
    private fun muteNotificationSounds(mute: Boolean) {
        try {
            val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

            if (mute) {
                // Save current volumes
                savedNotificationVolume = am.getStreamVolume(AudioManager.STREAM_NOTIFICATION)
                savedRingerMode = am.ringerMode

                // Mute notification sound (not ring)
                am.setStreamVolume(AudioManager.STREAM_NOTIFICATION, 0, 0)

                Log.d(TAG, "Notification sounds muted (saved vol=$savedNotificationVolume)")
            } else {
                // Restore notification volume
                if (savedNotificationVolume >= 0) {
                    am.setStreamVolume(AudioManager.STREAM_NOTIFICATION, savedNotificationVolume, 0)
                    Log.d(TAG, "Notification sounds restored (vol=$savedNotificationVolume)")
                    savedNotificationVolume = -1
                }
                if (savedRingerMode >= 0) {
                    savedRingerMode = -1
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to mute/unmute notification sounds: ${e.message}", e)
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    /**
     * System-level check: is our AppBlockerService listed as an enabled
     * accessibility service in Settings.Secure?
     */
    private fun isAccessibilityServiceEnabledInSettings(): Boolean {
        try {
            val serviceName = "${context.packageName}/.focusmode.AppBlockerService"
            val enabledServices = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            ) ?: return false

            val colonSplitter = TextUtils.SimpleStringSplitter(':')
            colonSplitter.setString(enabledServices)

            while (colonSplitter.hasNext()) {
                val componentName = colonSplitter.next()
                if (componentName.equals(serviceName, ignoreCase = true)) {
                    return true
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking accessibility settings: ${e.message}", e)
        }
        return false
    }

    /**
     * Clear any lingering DND from a previous version of the app.
     * This ensures INTERRUPTION_FILTER_ALL (normal) is restored.
     */
    private fun clearAnyLegacyDnd() {
        try {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.isNotificationPolicyAccessGranted) {
                val currentFilter = nm.currentInterruptionFilter
                if (currentFilter != NotificationManager.INTERRUPTION_FILTER_ALL) {
                    nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
                    Log.d(TAG, "Cleared lingering DND (was filter=$currentFilter)")
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not clear DND: ${e.message}")
        }
    }
}
