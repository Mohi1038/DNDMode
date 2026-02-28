const { queryAgent, saveWavToTemp } = require("../services/aiServerService");

const handleQuery = async (req, res) => {
    const { query } = req.body;

    if (!query || typeof query !== "string") {
        return res.status(400).json({ status: "error", message: "Missing 'query' field" });
    }

    console.log(`\n🎤 Agent Query: "${query}"`);

    try {
        // Get response from AI server
        const result = await queryAgent(query);

        console.log(result)

        if (result.type === "audio") {
            console.log(`   ✅ Received WAV: ${result.buffer.length} bytes`);
            const filename = saveWavToTemp(result.buffer);
            const audioUrl = `http://${req.headers.host}/api/audio/${filename}`;
            console.log(`   🔊 Audio URL: ${audioUrl}`);
            console.log("   ─────────────────────────────────");
            res.json({ status: "ok", audioUrl });
        } else {
            // AI server returned text/JSON instead of audio
            console.log(`   💬 AI responded with text: ${result.text}`);
            console.log("   ─────────────────────────────────");
            res.json({ status: "ok", text: result.text, audioUrl: null });
        }
    } catch (error) {
        console.error(`   ❌ Agent query failed: ${error.message}`);
        res.status(502).json({ status: "error", message: error.message });
    }
};

module.exports = { handleQuery };
