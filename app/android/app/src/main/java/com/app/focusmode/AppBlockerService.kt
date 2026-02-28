package com.app.focusmode

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import com.app.apptimer.AppTimerManager

class AppBlockerService : AccessibilityService() {

    companion object {
        private const val TAG = "AppBlockerService"

        @Volatile
        var isRunning = false
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isRunning = true

        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS
            notificationTimeout = 100
        }
        serviceInfo = info

        Log.d(TAG, "Accessibility Service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return

        val packageName = event.packageName?.toString() ?: return

        // Never block our own app
        if (packageName == "com.app") return

        // Check timer block FIRST (before whitelist, since users explicitly
        // set timers — the whitelist is only for focus mode system apps)
        val blockedByTimer = AppTimerManager.isBlockedByTimer(packageName)

        // For focus mode: respect the whitelist
        val blockedByFocus = FocusModeManager.isActive &&
            !FocusModeManager.isWhitelisted(packageName)

        if (!blockedByFocus && !blockedByTimer) return

        val reason = if (blockedByTimer) "timer" else "focus"
        Log.d(TAG, "Blocking app: $packageName (reason=$reason)")
        launchBlockingScreen(reason)
    }

    private fun launchBlockingScreen(reason: String = "focus") {
        val intent = Intent(this, BlockingActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
            addFlags(Intent.FLAG_ACTIVITY_NO_ANIMATION)
            putExtra("block_reason", reason)
        }

        try {
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to launch blocking screen: ${e.message}", e)
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "Accessibility Service interrupted")
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        Log.d(TAG, "Accessibility Service destroyed")
    }
}
