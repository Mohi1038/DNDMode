const axios = require('axios');

/**
 * Service to interact with the external SERVER_2 API
 */
class Server2Service {
    /**
     * Fetches sync and breakdown data from SERVER_2
     * @returns {Promise<Object>} The exact response from the external server
     */
    static async fetchSyncAndBreakdown() {
        const baseUrl = process.env.SERVER_2;

        if (!baseUrl) {
            throw new Error('SERVER_2 environment variable is not defined');
        }

        const url = `${baseUrl}/api/v1/sync-and-breakdown`;

        try {
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            console.error('[Server2Service] Error fetching sync and breakdown data:', error.message);
            // Optionally log more details: error.response?.data
            throw error;
        }
    }
}

module.exports = Server2Service;
