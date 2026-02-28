package com.app.wellbeing

import android.app.AppOpsManager
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import java.util.Calendar

class DigitalWellbeingModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {

    companion object {
        private const val TAG = "DigitalWellbeingModule"
    }

    override fun getName(): String = "DigitalWellbeingModule"

    @ReactMethod
    fun hasPermission(promise: Promise) {
        promise.resolve(isUsageAccessGranted())
    }

    @ReactMethod
    fun openUsageAccessSettings() {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    @ReactMethod
    fun getTodayUsageStats(promise: Promise) {
        if (!isUsageAccessGranted()) {
            promise.reject("PERMISSION_DENIED", "Usage access permission not granted")
            return
        }

        try {
            val usageStatsManager =
                context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

            // Today from 00:00
            val calendar = Calendar.getInstance().apply {
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val startTime = calendar.timeInMillis
            val endTime = System.currentTimeMillis()

            val stats = usageStatsManager.queryUsageStats(
                UsageStatsManager.INTERVAL_DAILY,
                startTime,
                endTime
            )

            if (stats.isNullOrEmpty()) {
                promise.resolve(Arguments.createArray())
                return
            }

            val pm = context.packageManager
            val result: WritableArray = Arguments.createArray()

            for (stat in stats) {
                // Skip apps with no foreground time
                if (stat.totalTimeInForeground <= 0) continue

                val map = Arguments.createMap().apply {
                    putString("packageName", stat.packageName)
                    putString("appName", getAppName(pm, stat.packageName))
                    putDouble("totalTimeInForeground", stat.totalTimeInForeground.toDouble())
                    putDouble("lastTimeUsed", stat.lastTimeUsed.toDouble())

                    // appLaunchCount added in API 30 — use reflection for compatibility
                    val launches = try {
                        val method = stat.javaClass.getMethod("getAppLaunchCount")
                        method.invoke(stat) as? Int ?: 0
                    } catch (_: Exception) { 0 }
                    putInt("launches", launches)
                }

                result.pushMap(map)
            }

            // Sort by totalTimeInForeground descending
            Log.d(TAG, "Collected usage stats for ${result.size()} apps")
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get usage stats: ${e.message}", e)
            promise.reject("USAGE_STATS_ERROR", e.message, e)
        }
    }

    private fun isUsageAccessGranted(): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun getAppName(pm: PackageManager, packageName: String): String {
        return try {
            val appInfo = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (e: Exception) {
            packageName
        }
    }
}
