package com.app.audio

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AudioPlayerModule(
    private val context: ReactApplicationContext
) : ReactContextBaseJavaModule(context) {

    companion object {
        private const val TAG = "AudioPlayerModule"
    }

    private var mediaPlayer: MediaPlayer? = null

    override fun getName(): String = "AudioPlayerModule"

    @ReactMethod
    fun playFromUrl(url: String, promise: Promise) {
        try {
            // Release any existing player
            mediaPlayer?.release()
            mediaPlayer = null

            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .setUsage(AudioAttributes.USAGE_ASSISTANT)
                        .build()
                )

                setDataSource(url)

                setOnPreparedListener {
                    Log.d(TAG, "Audio prepared, playing...")
                    it.start()
                    promise.resolve(true)
                }

                setOnCompletionListener {
                    Log.d(TAG, "Audio playback complete")
                    it.release()
                    if (mediaPlayer === it) mediaPlayer = null
                }

                setOnErrorListener { _, what, extra ->
                    Log.e(TAG, "Playback error: what=$what extra=$extra")
                    promise.reject("PLAYBACK_ERROR", "MediaPlayer error: $what/$extra")
                    true
                }

                prepareAsync()
            }

            Log.d(TAG, "Loading audio from: $url")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play audio: ${e.message}", e)
            promise.reject("PLAY_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            mediaPlayer?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
            mediaPlayer = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_FAILED", e.message, e)
        }
    }

    @ReactMethod
    fun isPlaying(promise: Promise) {
        promise.resolve(mediaPlayer?.isPlaying ?: false)
    }
}
