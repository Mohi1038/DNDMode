package com.app.apptimer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import com.app.MainActivity

/**
 * Foreground Service that polls UsageStatsManager every 15 seconds
 * and blocks apps whose usage has exceeded their daily timer limit.
 */
class AppTimerService : Service() {

    companion object {
        private const val TAG = "AppTimerService"
        private const val CHANNEL_ID = "app_timer_channel"
        private const val NOTIFICATION_ID = 9001
        private const val CHECK_INTERVAL_MS = 15_000L // 15 seconds
    }

    private val handler = Handler(Looper.getMainLooper())
    private var isRunning = false

    private val checkRunnable = object : Runnable {
        override fun run() {
            if (!isRunning) return

            try {
                val newlyBlocked = AppTimerManager.checkAndBlockApps(applicationContext)
                if (newlyBlocked > 0) {
                    Log.d(TAG, "Newly blocked $newlyBlocked app(s)")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error checking timers: ${e.message}", e)
            }

            // Auto-stop if no timers remain
            if (!AppTimerManager.hasAnyTimers(applicationContext)) {
                Log.d(TAG, "No timers active, stopping service")
                stopSelf()
                return
            }

            handler.postDelayed(this, CHECK_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (isRunning) {
            Log.d(TAG, "Service already running, ignoring duplicate start")
            return START_STICKY
        }

        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)

        isRunning = true
        handler.post(checkRunnable)
        Log.d(TAG, "AppTimerService started")

        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        handler.removeCallbacks(checkRunnable)
        Log.d(TAG, "AppTimerService destroyed")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ─── Notification ───────────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "App Timer Monitor",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Monitors app usage for daily timer limits"
                setShowBadge(false)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val contentIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle("App Timer Active")
            .setContentText("Monitoring your daily app usage limits")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
}
