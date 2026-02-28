package com.app.focusmode

/**
 * Singleton that holds focus mode state.
 * Accessed by AccessibilityService, Activities, and React Native module.
 */
object FocusModeManager {

    @Volatile
    var isActive: Boolean = false
        private set

    // Package names to whitelist (never block)
    private val whitelistedPackages = mutableSetOf(
        "com.app",                          // This app
        "com.android.systemui",             // System UI
        "com.android.launcher",             // Launcher variants
        "com.android.launcher3",
        "com.google.android.apps.nexuslauncher",
        "com.sec.android.app.launcher",     // Samsung launcher
        "com.android.settings",             // Settings (needed for permissions)
        "com.android.packageinstaller",
    )

    fun startFocusMode() {
        isActive = true
    }

    fun stopFocusMode() {
        isActive = false
    }

    fun isWhitelisted(packageName: String): Boolean {
        return whitelistedPackages.contains(packageName)
    }

    fun addToWhitelist(packageName: String) {
        whitelistedPackages.add(packageName)
    }

    fun removeFromWhitelist(packageName: String) {
        whitelistedPackages.remove(packageName)
    }
}
