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
            console.log(`[Server2Service] Fetching from ${url}`);
            const response = await axios.get(url, { timeout: 15000 });
            console.log(`[Server2Service] Received response from SERVER_2. length:`, JSON.stringify(response.data)?.length);
            return response.data;
        } catch (error) {
            console.error(`[Server2Service] Error fetching sync and breakdown data from ${url}:`, error.message);
            // Optionally log more details: error.response?.data
            throw error;
        }
    }
}

module.exports = Server2Service;
