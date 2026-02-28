package com.app.focusmode

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
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

    @ReactMethod
    fun startFocusMode() {
        FocusModeManager.startFocusMode()
        setNotificationMute(true)
        Log.d(TAG, "Focus Mode started")
    }

    @ReactMethod
    fun stopFocusMode() {
        FocusModeManager.stopFocusMode()
        setNotificationMute(false)
        Log.d(TAG, "Focus Mode stopped")
    }

    @ReactMethod
    fun isFocusModeActive(promise: Promise) {
        promise.resolve(FocusModeManager.isActive)
    }

    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        promise.resolve(AppBlockerService.isRunning)
    }

    @ReactMethod
    fun openAccessibilitySettings() {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    @ReactMethod
    fun isDndPermissionGranted(promise: Promise) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        promise.resolve(nm.isNotificationPolicyAccessGranted)
    }

    @ReactMethod
    fun openDndSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    private var savedPolicy: NotificationManager.Policy? = null

    private fun setNotificationMute(mute: Boolean) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (!nm.isNotificationPolicyAccessGranted) {
            Log.w(TAG, "DND policy access not granted, cannot mute notifications")
            return
        }

        try {
            if (mute) {
                // Save current policy so we can restore later
                savedPolicy = nm.notificationPolicy

                // Allow calls + repeat callers, suppress everything else
                val policy = NotificationManager.Policy(
                    NotificationManager.Policy.PRIORITY_CATEGORY_CALLS or
                    NotificationManager.Policy.PRIORITY_CATEGORY_REPEAT_CALLERS,
                    NotificationManager.Policy.PRIORITY_SENDERS_ANY,   // calls from anyone
                    NotificationManager.Policy.PRIORITY_SENDERS_ANY,   // messages from anyone (silent)
                    NotificationManager.Policy.SUPPRESSED_EFFECT_SCREEN_ON or
                    NotificationManager.Policy.SUPPRESSED_EFFECT_SCREEN_OFF or
                    NotificationManager.Policy.SUPPRESSED_EFFECT_PEEK or
                    NotificationManager.Policy.SUPPRESSED_EFFECT_AMBIENT or
                    NotificationManager.Policy.SUPPRESSED_EFFECT_NOTIFICATION_LIST.inv() and 0 // keep in list
                )
                nm.setNotificationPolicy(policy)
                nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
            } else {
                // Restore original policy and turn off DND
                savedPolicy?.let { nm.setNotificationPolicy(it) }
                nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
                savedPolicy = null
            }
            Log.d(TAG, "Notification mute set to: $mute (calls still ring)")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to set interruption filter: ${e.message}", e)
        }
    }
}
