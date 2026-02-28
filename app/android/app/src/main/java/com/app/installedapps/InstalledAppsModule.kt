package com.app.installedapps

import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.util.Base64
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream

class InstalledAppsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "InstalledAppsModule"

    @ReactMethod
    fun getSortedApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
                .filter { app ->
                    // Only user-installed apps (not system apps), OR system apps that have a launcher intent
                    val isUserApp = (app.flags and ApplicationInfo.FLAG_SYSTEM) == 0
                    val hasLauncher = pm.getLaunchIntentForPackage(app.packageName) != null
                    isUserApp || hasLauncher
                }
                .sortedBy { pm.getApplicationLabel(it).toString().lowercase() }

            val result = Arguments.createArray()
            for (app in apps) {
                val map = Arguments.createMap()
                map.putString("packageName", app.packageName)
                map.putString("label", pm.getApplicationLabel(app).toString())

                // Convert icon to base64
                try {
                    val drawable = pm.getApplicationIcon(app)
                    val bitmap = drawableToBitmap(drawable)
                    val stream = ByteArrayOutputStream()
                    bitmap.compress(Bitmap.CompressFormat.PNG, 50, stream)
                    val bytes = stream.toByteArray()
                    val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                    map.putString("icon", "data:image/png;base64,$base64")
                } catch (e: Exception) {
                    map.putString("icon", "")
                }

                result.pushMap(map)
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERR_INSTALLED_APPS", "Failed to get installed apps", e)
        }
    }

    private fun drawableToBitmap(drawable: Drawable): Bitmap {
        if (drawable is BitmapDrawable && drawable.bitmap != null) {
            return drawable.bitmap
        }
        val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 48
        val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 48
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, canvas.width, canvas.height)
        drawable.draw(canvas)
        return bitmap
    }
}
