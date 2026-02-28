const Server2Service = require('../services/server2.service');

/**
 * Controller for assignment endpoints
 */
class AssignmentController {
    /**
     * Proxies the request to get sync and breakdown data from SERVER_2
     */
    static async getSyncAndBreakdown(req, res) {
        try {
            const data = await Server2Service.fetchSyncAndBreakdown();

            // Return the EXACT same response
            return res.status(200).json(data);
        } catch (error) {
            console.error('[AssignmentController] getSyncAndBreakdown error:', error);

            // Return user-friendly error response based on requirements
            return res.status(502).json({
                status: "error",
                message: "Failed to fetch sync and breakdown data"
            });
        }
    }
}

module.exports = AssignmentController;
