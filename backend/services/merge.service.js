const Server2Service = require('./server2.service');

/**
 * Service to orchestrate fetching from SERVER_2 and merging with frontend payload
 */
class MergeService {
    /**
     * Fetches assignments and merges them with the existing frontend payload
     * @param {Object} frontendPayload The JSON payload coming from the client (API 2 equivalent)
     * @returns {Promise<Object>} The merged JSON ready for SERVER_3
     */
    static async mergePayloads(frontendPayload) {
        try {
            // Step 1: Fetch data from SERVER_2
            // const server2Data = await Server2Service.fetchSyncAndBreakdown();

            // Extract the 'data' array from the success response, or default to empty array
            const assignments = [];

            // Step 2 & 3: Merge both JSONs
            // SERVER_3 requires 'id' and 'category' on goals, but frontend might only send 'title' and 'type'
            const mappedLongTermGoals = (frontendPayload.long_term_goals || []).map((g, i) => ({
                id: g.id || `ltg-${i}`,
                title: g.title || '',
                category: g.category || g.type || 'general'
            }));

            const mappedShortTermGoals = (frontendPayload.short_term_goals || []).map((g, i) => ({
                id: g.id || `stg-${i}`,
                title: g.title || '',
                category: g.category || g.type || 'general'
            }));

            const mergedPayload = {
                ...frontendPayload,
                long_term_goals: mappedLongTermGoals,
                short_term_goals: mappedShortTermGoals,
                assignments: assignments
            };

            return mergedPayload;
        } catch (error) {
            console.error('[MergeService] Error merging payloads:', error.message);
            throw error;
        }
    }
}

module.exports = MergeService;
