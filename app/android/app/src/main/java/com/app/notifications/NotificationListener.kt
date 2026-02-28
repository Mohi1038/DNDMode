package com.app.notifications

import android.app.Notification
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.app.BuildConfig
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class NotificationListener : NotificationListenerService() {

    companion object {
        private const val TAG = "NotificationListener"
    }

    private val client by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .writeTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    private var mediaPlayer: MediaPlayer? = null

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        super.onNotificationPosted(sbn)
        if (sbn == null) return

        try {
            val json = extractAllNotificationData(sbn)
            postToBackend(json)
        } catch (e: Exception) {
            Log.e(TAG, "Error processing notification: ${e.message}", e)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        super.onNotificationRemoved(sbn)
        Log.d(TAG, "Notification removed: ${sbn?.packageName}")
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.d(TAG, "Notification Listener Service connected")
    }

    override fun onDestroy() {
        super.onDestroy()
        mediaPlayer?.release()
        mediaPlayer = null
    }

    private fun extractAllNotificationData(sbn: StatusBarNotification): JSONObject {
        val json = JSONObject()
        val packageName = sbn.packageName.orEmpty()

        val pm = applicationContext.packageManager
        val appName = try {
            val appInfo = pm.getApplicationInfo(packageName, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (e: Exception) {
            packageName
        }

        val notification = sbn.notification
        val extras = notification.extras

        // Core fields
        json.put("packageName", packageName)
        json.put("appName", appName)
        json.put("title", extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty())
        json.put("text", extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty())
        json.put("subText", extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty())
        json.put("bigText", extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty())
        json.put("infoText", extras.getCharSequence(Notification.EXTRA_INFO_TEXT)?.toString().orEmpty())
        json.put("summaryText", extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)?.toString().orEmpty())
        json.put("titleBig", extras.getCharSequence(Notification.EXTRA_TITLE_BIG)?.toString().orEmpty())

        // Timing
        json.put("time", sbn.postTime)

        // Identifiers
        json.put("notificationId", sbn.id)
        json.put("key", sbn.key.orEmpty())
        json.put("tag", sbn.tag.orEmpty())
        json.put("groupKey", sbn.groupKey.orEmpty())

        // Notification metadata
        json.put("category", notification.category.orEmpty())
        json.put("ticker", notification.tickerText?.toString().orEmpty())

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            json.put("channelId", notification.channelId.orEmpty())
        }

        // Flags
        json.put("isOngoing", (notification.flags and Notification.FLAG_ONGOING_EVENT) != 0)
        json.put("isClearable", sbn.isClearable)
        json.put("isGroupSummary", (notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0)
        json.put("autoCancel", (notification.flags and Notification.FLAG_AUTO_CANCEL) != 0)

        // Priority & visibility
        @Suppress("DEPRECATION")
        json.put("priority", notification.priority)
        json.put("visibility", notification.visibility)

        // Number (badge count)
        json.put("number", notification.number)

        return json
    }

    private fun postToBackend(json: JSONObject) {
        val serverUrl = BuildConfig.SERVER_URL
        if (serverUrl.isBlank()) {
            Log.w(TAG, "SERVER_URL not set in .env, skipping POST")
            return
        }

        val body = json.toString().toRequestBody(jsonMediaType)
        val request = Request.Builder()
            .url("$serverUrl/notifications/ingest")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Failed to POST notification: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!it.isSuccessful) {
                        Log.e(TAG, "POST notification failed: ${it.code}")
                        return
                    }

                    // Parse response — check if backend returned an audioUrl
                    try {
                        val responseBody = it.body?.string() ?: return
                        val responseJson = JSONObject(responseBody)

                        if (responseJson.has("audioUrl") && !responseJson.isNull("audioUrl")) {
                            val audioUrl = responseJson.getString("audioUrl")
                            Log.d(TAG, "🔊 Audio response received: $audioUrl")
                            playAudio(audioUrl)
                        } else {
                            Log.d(TAG, "Notification sent to backend successfully")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Error parsing response: ${e.message}", e)
                    }
                }
            }
        })
    }

    private fun playAudio(url: String) {
        try {
            // Release any existing player
            mediaPlayer?.release()
            mediaPlayer = null

            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                )

                setDataSource(url)

                setOnPreparedListener {
                    Log.d(TAG, "🔊 Playing AI audio response...")
                    it.start()
                }

                setOnCompletionListener {
                    Log.d(TAG, "🔊 Audio playback complete")
                    it.release()
                    if (mediaPlayer === it) mediaPlayer = null
                }

                setOnErrorListener { _, what, extra ->
                    Log.e(TAG, "Audio playback error: what=$what extra=$extra")
                    true
                }

                prepareAsync()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play audio: ${e.message}", e)
        }
    }
}
