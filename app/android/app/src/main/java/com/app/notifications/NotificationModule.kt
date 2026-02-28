package com.app.notifications

import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.app.BuildConfig
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {

    init {
        reactContext = context
    }

    override fun getName(): String = MODULE_NAME

    @ReactMethod
    fun openListenerSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    @ReactMethod
    fun isListenerEnabled(promise: Promise) {
        try {
            val packageName = context.packageName
            val enabledPackages = NotificationManagerCompat
                .getEnabledListenerPackages(context)
            promise.resolve(enabledPackages.contains(packageName))
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check listener status: ${e.message}", e)
        }
    }

    /**
     * Returns the SERVER_URL from BuildConfig (read from .env at build time).
     */
    @ReactMethod
    fun getServerUrl(promise: Promise) {
        promise.resolve(BuildConfig.SERVER_URL)
    }

    companion object {
        const val MODULE_NAME = "NotificationModule"

        @Volatile
        var reactContext: ReactApplicationContext? = null
            internal set
    }
}
