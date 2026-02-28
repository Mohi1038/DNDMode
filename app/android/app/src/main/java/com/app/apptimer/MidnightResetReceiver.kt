package com.app.apptimer

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * BroadcastReceiver triggered at midnight by AlarmManager.
 * Clears all blocked apps and reschedules itself for the next midnight.
 * Also handles BOOT_COMPLETED to reschedule after reboot.
 */
class MidnightResetReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "MidnightResetReceiver"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        Log.d(TAG, "Received: ${intent?.action ?: "midnight_reset"}")

        // Reset all blocks
        AppTimerManager.resetForNewDay(context)

        // Reschedule for next midnight
        AppTimerManager.scheduleMidnightReset(context)

        // Restart the monitoring service if there are active timers
        if (AppTimerManager.hasAnyTimers(context)) {
            val serviceIntent = Intent(context, AppTimerService::class.java)
            try {
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to restart timer service: ${e.message}", e)
            }
        }
    }
}
