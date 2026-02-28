const path = require("path");
const fs = require("fs");

const AI_BASE_URL = () =>
    `http://${process.env.AI_SERVER_HOST}:${process.env.AI_SERVER_PORT}`;

/**
 * Forward notification data to the external AI server.
 * Only sends the fields the AI server expects.
 * Returns { type: 'audio', buffer } or { type: 'json', data } or { type: 'text', text }.
 */
const forwardNotification = async (notification) => {
    const url = `${AI_BASE_URL()}/api/v1/notifications/ingest`;
    console.log(`   ➡️  Forwarding to AI: ${url}`);

    // AI server expects exactly these fields
    const payload = {
        packageName: notification.packageName || "",
        appName: notification.appName || "",
        title: notification.title || "",
        text: notification.text || "",
        time: notification.time || Date.now(),
        notificationId: String(notification.notificationId || ""),
        isOngoing: notification.isOngoing || false,
    };

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`AI server error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("audio")) {
        const arrayBuffer = await response.arrayBuffer();
        return { type: "audio", buffer: Buffer.from(arrayBuffer) };
    } else {
        const text = await response.text();
        try {
            return { type: "json", data: JSON.parse(text) };
        } catch {
            return { type: "text", text };
        }
    }
};

/**
 * Send speech query to AI server.
 * Returns { type: 'audio', buffer } or { type: 'text', text }.
 */
const queryAgent = async (query) => {
    const url = `${AI_BASE_URL()}/api/v1/agent/query`;
    console.log(`   ➡️  Querying AI: ${url}`);

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
    });

    if (!response.ok) {
        // Try to get error body for debugging
        const errText = await response.text().catch(() => "");
        console.error(`   ❌ AI response: ${response.status} — ${errText.slice(0, 200)}`);
        throw new Error(`AI server error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("audio")) {
        const arrayBuffer = await response.arrayBuffer();
        return { type: "audio", buffer: Buffer.from(arrayBuffer) };
    } else {
        // Response is text/JSON — not audio
        const text = await response.text();
        try {
            const json = JSON.parse(text);
            return { type: "text", text: json.response || json.text || json.message || text };
        } catch {
            return { type: "text", text };
        }
    }
};

/**
 * Save WAV buffer to temp file — returns filename.
 */
const saveWavToTemp = (wavBuffer) => {
    const tempDir = path.join(__dirname, "..", "temp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const filename = `response_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.wav`;
    const filePath = path.join(tempDir, filename);
    fs.writeFileSync(filePath, wavBuffer);

    // Auto-delete after 5 minutes
    setTimeout(() => {
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (_) { }
    }, 5 * 60 * 1000);

    return filename;
};

module.exports = {
    forwardNotification,
    queryAgent,
    saveWavToTemp,
};
