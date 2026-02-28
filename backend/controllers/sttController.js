const receiveSpeech = (req, res) => {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
        return res.status(400).json({ status: "error", message: "Missing 'text' field" });
    }

    console.log(`\n🎤 Speech Received: "${text}"`);
    console.log(`   Time: ${new Date().toLocaleTimeString()}`);
    console.log("   ─────────────────────────────────");

    res.json({ status: "ok", text });
};

module.exports = { receiveSpeech };
