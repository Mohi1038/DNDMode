package com.app

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.app.notifications.NotificationPackage
import com.app.speech.SpeechToTextPackage
import com.app.focusmode.FocusModePackage
import com.app.audio.AudioPlayerPackage
import com.app.wellbeing.DigitalWellbeingPackage
import com.app.installedapps.InstalledAppsPackage
import com.app.apptimer.AppTimerPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
          add(NotificationPackage())
          add(SpeechToTextPackage())
          add(FocusModePackage())
          add(AudioPlayerPackage())
          add(DigitalWellbeingPackage())
          add(InstalledAppsPackage())
          add(AppTimerPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
