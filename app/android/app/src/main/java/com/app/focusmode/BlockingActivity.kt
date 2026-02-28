package com.app.focusmode

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

class BlockingActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Make fullscreen and keep on top
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        )

        // Build UI programmatically (no XML needed)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(0xFF1A1A2E.toInt()) // Dark background
            setPadding(60, 60, 60, 60)
        }

        val iconText = TextView(this).apply {
            text = "🔒"
            textSize = 64f
            gravity = Gravity.CENTER
        }

        val titleText = TextView(this).apply {
            text = "Focus Mode is ON"
            textSize = 28f
            setTextColor(0xFFFFFFFF.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 40, 0, 20)
        }

        val subtitleText = TextView(this).apply {
            text = "This app is currently blocked.\nStay focused on what matters."
            textSize = 16f
            setTextColor(0xAAFFFFFF.toInt())
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 60)
        }

        val goBackText = TextView(this).apply {
            text = "Tap to go back"
            textSize = 14f
            setTextColor(0x88FFFFFF.toInt())
            gravity = Gravity.CENTER
            setOnClickListener { goHome() }
        }

        layout.addView(iconText)
        layout.addView(titleText)
        layout.addView(subtitleText)
        layout.addView(goBackText)

        // Make the entire layout go home on tap
        layout.setOnClickListener { goHome() }

        setContentView(layout)
    }

    private fun goHome() {
        val intent = packageManager.getLaunchIntentForPackage("com.app")
        if (intent != null) {
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        }
        finish()
    }

    override fun onBackPressed() {
        // Block back button — go home instead
        if (FocusModeManager.isActive) {
            goHome()
        } else {
            super.onBackPressed()
        }
    }
}
