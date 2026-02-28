const express = require("express");
const router = express.Router();

// POST — ingest digital wellbeing usage stats
router.post("/ingest", (req, res) => {
    const { usageStats } = req.body;

    if (!usageStats || !Array.isArray(usageStats)) {
        return res.status(400).json({ status: "error", message: "Missing 'usageStats' array" });
    }

    console.log(`\n📊 Digital Wellbeing — ${usageStats.length} apps:`);

    // Sort by screen time descending
    const sorted = [...usageStats].sort((a, b) => b.totalTimeInForeground - a.totalTimeInForeground);

    for (const stat of sorted) {
        const mins = Math.round(stat.totalTimeInForeground / 60000);
        console.log(`   ${stat.appName.padEnd(25)} ${mins} min   ${stat.launches} launches`);
    }

    const totalMins = Math.round(sorted.reduce((sum, s) => sum + s.totalTimeInForeground, 0) / 60000);
    console.log(`   ─────────────────────────────────`);
    console.log(`   Total screen time: ${totalMins} min`);
    console.log(`   ─────────────────────────────────`);

    res.json({ status: "ok", appsTracked: usageStats.length, totalMinutes: totalMins });
});

module.exports = router;
