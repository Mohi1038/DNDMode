package com.app.speech

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class SpeechToTextModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context), LifecycleEventListener {

    companion object {
        private const val TAG = "SpeechToTextModule"
        private const val EVENT_SPEECH_RESULT = "onSpeechResult"
        private const val EVENT_SPEECH_ERROR = "onSpeechError"
        private const val EVENT_SPEECH_START = "onSpeechStart"
        private const val EVENT_SPEECH_END = "onSpeechEnd"
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private var isListening = false
    private var shouldContinue = false

    private val audioManager by lazy {
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    private var originalMusicVolume = -1

    init {
        context.addLifecycleEventListener(this)
    }

    override fun getName(): String = "SpeechToTextModule"

    @ReactMethod
    fun isAvailable(promise: Promise) {
        promise.resolve(SpeechRecognizer.isRecognitionAvailable(context))
    }

    @ReactMethod
    fun hasPermission(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }

    @ReactMethod
    fun startListening() {
        shouldContinue = true
        muteBeepSound()

        val activity = context.currentActivity
        if (activity == null) {
            sendError("NO_ACTIVITY", "Activity is not available")
            return
        }

        activity.runOnUiThread {
            initializeRecognizer()
            startRecognition()
        }
    }

    @ReactMethod
    fun stopListening() {
        shouldContinue = false
        isListening = false
        restoreBeepSound()

        context.currentActivity?.runOnUiThread {
            try {
                speechRecognizer?.stopListening()
            } catch (e: Exception) {
                Log.w(TAG, "Error stopping listener: ${e.message}")
            }
        }
    }

    @ReactMethod
    fun destroy() {
        shouldContinue = false
        isListening = false
        restoreBeepSound()

        context.currentActivity?.runOnUiThread {
            try {
                speechRecognizer?.destroy()
            } catch (e: Exception) {
                Log.w(TAG, "Error destroying recognizer: ${e.message}")
            }
            speechRecognizer = null
        }
    }

    // Required by NativeEventEmitter to suppress warnings
    @ReactMethod
    fun addListener(eventName: String) { /* no-op */ }

    @ReactMethod
    fun removeListeners(count: Int) { /* no-op */ }

    private fun muteBeepSound() {
        try {
            if (originalMusicVolume == -1) {
                originalMusicVolume = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            }
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, 0, 0)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to mute beep: ${e.message}")
        }
    }

    private fun restoreBeepSound() {
        try {
            if (originalMusicVolume != -1) {
                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, originalMusicVolume, 0)
                originalMusicVolume = -1
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to restore volume: ${e.message}")
        }
    }

    private fun initializeRecognizer() {
        if (speechRecognizer != null) return

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(createRecognitionListener())
        }
        Log.d(TAG, "SpeechRecognizer initialized")
    }

    private fun startRecognition() {
        if (isListening) return

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 5000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L)
        }

        try {
            speechRecognizer?.startListening(intent)
            isListening = true
            Log.d(TAG, "Listening started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start listening: ${e.message}", e)
            sendError("START_FAILED", e.message ?: "Unknown error")
        }
    }

    private fun restartListening() {
        if (!shouldContinue) return

        context.currentActivity?.runOnUiThread {
            // Small delay to avoid rapid restarts
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                if (shouldContinue) {
                    isListening = false
                    startRecognition()
                }
            }, 300)
        }
    }

    private fun createRecognitionListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                sendEvent(EVENT_SPEECH_START, Arguments.createMap().apply {
                    putBoolean("listening", true)
                })
            }

            override fun onBeginningOfSpeech() {
                Log.d(TAG, "Speech begun")
            }

            override fun onRmsChanged(rmsdB: Float) {
                // Volume level — unused for now
            }

            override fun onBufferReceived(buffer: ByteArray?) {}

            override fun onEndOfSpeech() {
                isListening = false
                sendEvent(EVENT_SPEECH_END, Arguments.createMap().apply {
                    putBoolean("listening", false)
                })
            }

            override fun onError(error: Int) {
                isListening = false
                val errorMessage = getErrorMessage(error)
                Log.e(TAG, "Recognition error: $errorMessage (code: $error)")

                // Errors 6 (NO_SPEECH) and 7 (NO_MATCH) are normal — just restart
                if (error == SpeechRecognizer.ERROR_NO_MATCH ||
                    error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                ) {
                    restartListening()
                    return
                }

                sendError("RECOGNITION_ERROR", errorMessage)

                // Retry on recoverable errors
                if (error != SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                    restartListening()
                }
            }

            override fun onResults(results: Bundle?) {
                isListening = false
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull()?.trim()

                if (!text.isNullOrEmpty()) {
                    Log.d(TAG, "Final result: $text")
                    sendEvent(EVENT_SPEECH_RESULT, Arguments.createMap().apply {
                        putString("text", text)
                        putBoolean("isFinal", true)
                    })
                }

                // Restart for continuous listening
                restartListening()
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull()?.trim()

                if (!text.isNullOrEmpty()) {
                    sendEvent(EVENT_SPEECH_RESULT, Arguments.createMap().apply {
                        putString("text", text)
                        putBoolean("isFinal", false)
                    })
                }
            }

            override fun onEvent(eventType: Int, params: Bundle?) {}
        }
    }

    private fun getErrorMessage(error: Int): String = when (error) {
        SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
        SpeechRecognizer.ERROR_CLIENT -> "Client error"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Insufficient permissions"
        SpeechRecognizer.ERROR_NETWORK -> "Network error"
        SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network timeout"
        SpeechRecognizer.ERROR_NO_MATCH -> "No speech match"
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer busy"
        SpeechRecognizer.ERROR_SERVER -> "Server error"
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech detected"
        else -> "Unknown error ($error)"
    }

    private fun sendEvent(eventName: String, params: com.facebook.react.bridge.WritableMap) {
        if (context.hasActiveCatalystInstance()) {
            context
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        }
    }

    private fun sendError(code: String, message: String) {
        sendEvent(EVENT_SPEECH_ERROR, Arguments.createMap().apply {
            putString("code", code)
            putString("message", message)
        })
    }

    // Lifecycle
    override fun onHostResume() {}

    override fun onHostPause() {}

    override fun onHostDestroy() {
        shouldContinue = false
        isListening = false
        speechRecognizer?.destroy()
        speechRecognizer = null
    }
}
