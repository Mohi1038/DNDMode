package com.app.apptimer

import android.app.AlarmManager
import android.app.PendingIntent
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import org.json.JSONObject
import java.util.Calendar
import java.util.concurrent.ConcurrentHashMap

/**
 * Singleton managing app timer state:
 *  - Persists limits in SharedPreferences (packageName → limitMinutes)
 *  - Tracks which apps are currently blocked in-memory
 *  - Queries UsageStatsManager for today's foreground time
 */
object AppTimerManager {

    private const val TAG = "AppTimerManager"
    private const val PREFS_NAME = "app_timer_prefs"
    private const val KEY_TIMERS = "timers_json"  // JSON: { "pkg": limitMinutes, ... }

    /** In-memory set of currently blocked package names */
    private val blockedApps = ConcurrentHashMap<String, Boolean>()

    // ─── Timer CRUD ─────────────────────────────────────────────────────

    fun setTimer(ctx: Context, packageName: String, limitMinutes: Int) {
        val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = JSONObject(prefs.getString(KEY_TIMERS, "{}") ?: "{}")
        json.put(packageName, limitMinutes)
        prefs.edit().putString(KEY_TIMERS, json.toString()).apply()
        Log.d(TAG, "setTimer: $packageName → ${limitMinutes}min")

        // Schedule midnight reset if not already scheduled
        scheduleMidnightReset(ctx)
    }

    fun removeTimer(ctx: Context, packageName: String) {
        val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = JSONObject(prefs.getString(KEY_TIMERS, "{}") ?: "{}")
        json.remove(packageName)
        prefs.edit().putString(KEY_TIMERS, json.toString()).apply()

        // Unblock immediately
        blockedApps.remove(packageName)
        Log.d(TAG, "removeTimer: $packageName (unblocked)")
    }

    fun getAllTimers(ctx: Context): Map<String, Int> {
        val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = JSONObject(prefs.getString(KEY_TIMERS, "{}") ?: "{}")
        val result = mutableMapOf<String, Int>()
        for (key in json.keys()) {
            result[key] = json.getInt(key)
        }
        return result
    }

    fun hasAnyTimers(ctx: Context): Boolean {
        return getAllTimers(ctx).isNotEmpty()
    }

    // ─── Usage checking & blocking ──────────────────────────────────────

    /**
     * Checks today's usage for every timer. If usage >= limit, marks the app
     * as blocked. Returns the number of newly blocked apps.
     */
    fun checkAndBlockApps(ctx: Context): Int {
        val timers = getAllTimers(ctx)
        if (timers.isEmpty()) return 0

        val usageMap = getTodayUsageMinutes(ctx)
        var newlyBlocked = 0

        for ((pkg, limitMinutes) in timers) {
            val usedMinutes = usageMap[pkg] ?: 0.0
            if (usedMinutes >= limitMinutes) {
                if (blockedApps.put(pkg, true) == null) {
                    newlyBlocked++
                    Log.d(TAG, "BLOCKED: $pkg (used=${usedMinutes}min, limit=${limitMinutes}min)")
                }
            }
        }
        return newlyBlocked
    }

    /**
     * Returns a list of timer data for each tracked app:
     *  { packageName, limitMinutes, usedMinutes, remainingMinutes, isBlocked }
     */
    fun getTimerData(ctx: Context): List<Map<String, Any>> {
        val timers = getAllTimers(ctx)
        val usageMap = getTodayUsageMinutes(ctx)
        val result = mutableListOf<Map<String, Any>>()

        for ((pkg, limitMinutes) in timers) {
            val usedMinutes = (usageMap[pkg] ?: 0.0).toInt()
            val remaining = (limitMinutes - usedMinutes).coerceAtLeast(0)
            result.add(mapOf(
                "packageName" to pkg,
                "limitMinutes" to limitMinutes,
                "usedMinutes" to usedMinutes,
                "remainingMinutes" to remaining,
                "isBlocked" to (blockedApps[pkg] == true)
            ))
        }
        return result
    }

    // ─── Blocking queries (used by AppBlockerService) ───────────────────

    fun isBlockedByTimer(packageName: String): Boolean {
        return blockedApps[packageName] == true
    }

    /**
     * Returns the block reason for the given package:
     *  "timer" if blocked by timer, "focus" if focus mode active, null if not blocked.
     */
    fun getBlockReason(packageName: String, isFocusModeActive: Boolean): String? {
        if (blockedApps[packageName] == true) return "timer"
        if (isFocusModeActive) return "focus"
        return null
    }

    // ─── Midnight reset ─────────────────────────────────────────────────

    /**
     * Called at midnight: clears all blocked state but keeps timer limits.
     */
    fun resetForNewDay(ctx: Context) {
        blockedApps.clear()
        Log.d(TAG, "resetForNewDay: all blocks cleared, limits retained")
    }

    // ─── AlarmManager scheduling ────────────────────────────────────────

    fun scheduleMidnightReset(ctx: Context) {
        val alarmManager = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(ctx, MidnightResetReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            ctx, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Next midnight
        val calendar = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val triggerTime = calendar.timeInMillis

        // Try exact alarm if permitted, otherwise fall back to inexact
        // (a few minutes drift at midnight is perfectly fine for resetting timers)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Android 12+: check if exact alarm permission is granted
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent
                    )
                    Log.d(TAG, "Midnight reset scheduled (exact) for ${calendar.time}")
                } else {
                    // Fallback: inexact alarm — no permission needed
                    alarmManager.setAndAllowWhileIdle(
                        AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent
                    )
                    Log.d(TAG, "Midnight reset scheduled (inexact) for ${calendar.time}")
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent
                )
                Log.d(TAG, "Midnight reset scheduled (exact) for ${calendar.time}")
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent
                )
                Log.d(TAG, "Midnight reset scheduled (exact) for ${calendar.time}")
            }
        } catch (e: SecurityException) {
            // If exact alarm fails for any reason, fall back to inexact
            Log.w(TAG, "Exact alarm not permitted, using inexact: ${e.message}")
            alarmManager.set(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            Log.d(TAG, "Midnight reset scheduled (fallback) for ${calendar.time}")
        }
    }

    // ─── UsageStats helper ──────────────────────────────────────────────

    /**
     * Queries UsageStatsManager for today's foreground time.
     * Returns map of packageName → foreground minutes (as Double).
     */
    private fun getTodayUsageMinutes(ctx: Context): Map<String, Double> {
        val usageStatsManager =
            ctx.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
                ?: return emptyMap()

        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val startTime = calendar.timeInMillis
        val endTime = System.currentTimeMillis()

        val stats = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY, startTime, endTime
        ) ?: return emptyMap()

        val result = mutableMapOf<String, Double>()
        for (stat in stats) {
            if (stat.totalTimeInForeground > 0) {
                result[stat.packageName] = stat.totalTimeInForeground / 60_000.0
            }
        }
        return result
    }
}
