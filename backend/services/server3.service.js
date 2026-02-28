const axios = require('axios');

/**
 * Service to interact with the external SERVER_3 API for timetable generation
 */
class Server3Service {
    /**
     * Sends the merged payload to SERVER_3 to generate the timetable
     * @param {Object} mergedPayload The merged JSON from SERVER_2 and frontend
     * @returns {Promise<Object>} The generated timetable response
     */
    static async generateTimetable(mergedPayload) {
        const baseUrl = process.env.SERVER_3;

        if (!baseUrl) {
            throw new Error('SERVER_3 environment variable is not defined');
        }

        const url = `${baseUrl}/generate_daily_routine`; // Or whatever the exact path is on SERVER_3

        try {
            console.log(`[Server3Service] Sending payload to ${url}...`);
            const response = await axios.post(url, mergedPayload, { timeout: 60000 });
            console.log(`[Server3Service] Received response from SERVER_3.`);
            return response.data;
        } catch (error) {
            console.error(`[Server3Service] Error generating timetable at ${url}:`, error.message);
            throw error;
        }
    }
}

module.exports = Server3Service;
