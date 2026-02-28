const store = require("../store/notificationStore");
const { forwardNotification, saveWavToTemp } = require("../services/aiServerService");

// Throttle: skip duplicate notifications within 30 seconds
const THROTTLE_MS = 30 * 1000;
const recentForwards = new Map(); // key → timestamp

function isThrottled(notification) {
    const key = `${notification.packageName}:${notification.title}`;
    const now = Date.now();
    const lastSent = recentForwards.get(key);

    if (lastSent && now - lastSent < THROTTLE_MS) {
        return true;
    }

    recentForwards.set(key, now);

    // Cleanup old entries every 100 inserts
    if (recentForwards.size > 200) {
        for (const [k, t] of recentForwards) {
            if (now - t > THROTTLE_MS) recentForwards.delete(k);
        }
    }

    return false;
}

/**
 * Ingest notification — store locally AND forward to AI server.
 * If AI returns audio, save it and include audioUrl in response.
 */
const ingestNotification = async (req, res) => {
    const notification = store.addNotification(req.body);

    console.log("\n📱 Notification Ingested:");
    console.log(`   App: ${notification.appName} (${notification.packageName})`);
    console.log(`   Title: ${notification.title}`);
    console.log(`   Text: ${notification.text}`);

    // Skip grouped summary notifications or empty text
    if (notification.text && notification.text.includes("new messages") || (notification.text || "").trim() === "") {
        console.log("   ⏭️  Skipped (group summary or empty)");
        console.log("   ─────────────────────────────────");
        return res.json({ status: "ok" });
    }

    // Throttle: don't forward same notification within 30s
    // if (isThrottled(notification)) {
    //     console.log("   ⏱️  Throttled (sent < 30s ago)");
    //     console.log("   ─────────────────────────────────");
    //     return res.json({ status: "ok" });
    // }

    // Forward to AI server and wait for response
    try {
        const result = await forwardNotification(notification);
        console.log("   AI Server Response:", result);
        if (result.type === "audio") {
            // AI returned audio — save and return URL
            const filename = saveWavToTemp(result.buffer);
            const host = req.headers.host || `localhost:${process.env.PORT || 5000}`;
            const audioUrl = `http://${host}/api/audio/${filename}`;

            console.log(`   🔊 AI returned audio: ${result.buffer.length} bytes`);
            console.log(`   🔊 Audio URL: ${audioUrl}`);
            console.log("   ─────────────────────────────────");
            return res.json({ status: "ok", audioUrl });
        } else {
            console.log("   ✅ Forwarded to AI server");
            console.log("   ─────────────────────────────────");
            return res.json({ status: "ok" });
        }
    } catch (err) {
        console.error(`   ⚠️  AI forward failed: ${err.message}`);
        console.log("   ─────────────────────────────────");
        return res.json({ status: "ok" });
    }
};

const getAllNotifications = (req, res) => {
    res.json({
        count: store.getCount(),
        notifications: store.getAllNotifications(),
    });
};

const getLatestNotification = (req, res) => {
    const latest = store.getLatestNotification();
    if (!latest) {
        return res.json({ message: "No notifications yet" });
    }
    res.json(latest);
};

const clearAllNotifications = (req, res) => {
    store.clearNotifications();
    res.json({ success: true, message: "All notifications cleared" });
};

module.exports = {
    ingestNotification,
    getAllNotifications,
    getLatestNotification,
    clearAllNotifications,
};
