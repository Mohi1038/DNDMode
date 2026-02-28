package com.app.apptimer

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AppTimerModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {

    companion object {
        private const val TAG = "AppTimerModule"
    }

    override fun getName(): String = "AppTimerModule"

    // ─── Permission methods ─────────────────────────────────────────────

    @ReactMethod
    fun hasUsagePermission(promise: Promise) {
        promise.resolve(isUsageAccessGranted())
    }

    @ReactMethod
    fun openUsageAccessSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open usage access settings: ${e.message}", e)
            promise.reject("OPEN_SETTINGS_ERROR", e.message, e)
        }
    }

    // ─── Timer CRUD ─────────────────────────────────────────────────────

    @ReactMethod
    fun setAppTimer(packageName: String, limitMinutes: Int, promise: Promise) {
        try {
            if (!isUsageAccessGranted()) {
                promise.reject(
                    "PERMISSION_DENIED",
                    "Usage access permission not granted. Call openUsageAccessSettings() first."
                )
                return
            }
            AppTimerManager.setTimer(context, packageName, limitMinutes)
            // Auto-start the monitoring service
            startServiceInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "setAppTimer failed: ${e.message}", e)
            promise.reject("SET_TIMER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun removeAppTimer(packageName: String, promise: Promise) {
        try {
            AppTimerManager.removeTimer(context, packageName)
            // Stop service if no more timers
            if (!AppTimerManager.hasAnyTimers(context)) {
                stopServiceInternal()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "removeAppTimer failed: ${e.message}", e)
            promise.reject("REMOVE_TIMER_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getAppTimers(promise: Promise) {
        try {
            val data = AppTimerManager.getTimerData(context)
            val result = Arguments.createArray()
            for (item in data) {
                val map = Arguments.createMap().apply {
                    putString("packageName", item["packageName"] as String)
                    putInt("limitMinutes", item["limitMinutes"] as Int)
                    putInt("usedMinutes", item["usedMinutes"] as Int)
                    putInt("remainingMinutes", item["remainingMinutes"] as Int)
                    putBoolean("isBlocked", item["isBlocked"] as Boolean)
                }
                result.pushMap(map)
            }
            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "getAppTimers failed: ${e.message}", e)
            promise.reject("GET_TIMERS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun startTimerService(promise: Promise) {
        try {
            startServiceInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "startTimerService failed: ${e.message}", e)
            promise.reject("START_SERVICE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopTimerService(promise: Promise) {
        try {
            stopServiceInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "stopTimerService failed: ${e.message}", e)
            promise.reject("STOP_SERVICE_ERROR", e.message, e)
        }
    }

    // ─── Helpers ────────────────────────────────────────────────────────

    private fun isUsageAccessGranted(): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun startServiceInternal() {
        val intent = Intent(context, AppTimerService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
        Log.d(TAG, "Timer service start requested")
    }

    private fun stopServiceInternal() {
        val intent = Intent(context, AppTimerService::class.java)
        context.stopService(intent)
        Log.d(TAG, "Timer service stop requested")
    }
}
