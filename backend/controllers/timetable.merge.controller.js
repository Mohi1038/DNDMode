const MergeService = require('../services/merge.service');
const Server3Service = require('../services/server3.service');

/**
 * Controller for timetable generation and merging
 */
class TimetableMergeController {
    /**
     * Handles POST /api/v1/timetable/generate
     */
    static async generateTimetable(req, res) {
        try {
            // The frontend payload (equivalent to API 2 response)
            const frontendPayload = req.body;

            console.log('[TimetableMergeController] Frontend payload:', JSON.stringify(frontendPayload, null, 2));

            // Step 1 & 3: Fetch assignments from SERVER_2 and merge with frontend payload
            const mergedPayload = await MergeService.mergePayloads(frontendPayload);

            // Step 4: Send POST request to SERVER_3
            let server3Response = await Server3Service.generateTimetable(mergedPayload);

            console.log('[TimetableMergeController] Raw SERVER_3 response type:', typeof server3Response);
            console.log('[TimetableMergeController] Raw SERVER_3 response:', JSON.stringify(server3Response, null, 2));

            let parsedResponse = server3Response;

            // Handle string formats, including potential markdown wrapping from AI endpoints
            if (typeof server3Response === 'string') {
                try {
                    // Strip ```json and ``` if they exist
                    let cleanString = server3Response.replace(/```json/gi, '').replace(/```/g, '').trim();
                    parsedResponse = JSON.parse(cleanString);
                } catch (e) {
                    console.error("SERVER_3 response could not be parsed as JSON:", server3Response);
                }
            }

            // Fallback: Sometimes response.data itself might contain a .data or .response property if double-wrapped
            if (parsedResponse && !parsedResponse.generated_plan && parsedResponse.data?.generated_plan) {
                parsedResponse = parsedResponse.data;
            } else if (parsedResponse && !parsedResponse.generated_plan && parsedResponse.response?.generated_plan) {
                parsedResponse = parsedResponse.response;
            }

            // Step 6: Validate timetable format
            if (parsedResponse?.data?.scheduled_tasks) {
                // Step 7: Return timetable to frontend
                return res.status(200).json({
                    status: "success",
                    timetable: parsedResponse.data.scheduled_tasks
                });
            } else {
                throw new Error("Invalid format received from SERVER_3: Missing generated_plan.scheduled_tasks");
            }
        } catch (error) {
            console.error('[TimetableMergeController] generateTimetable error:', error);

            // Return user-friendly error response
            return res.status(500).json({
                status: "error",
                message: "Failed to generate timetable"
            });
        }
    }
}

module.exports = TimetableMergeController;
