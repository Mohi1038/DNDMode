import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini with API Key from environment variables
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export const uploadTimetable = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image uploaded' });
        }

        console.log('Processing image with Gemini VLM...');

        // Convert multer buffer to base64 for Gemini
        const base64MimeType = req.file.mimetype;
        const base64Image = req.file.buffer.toString('base64');

        // Choose the Gemini Pro Vision model
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
      Analyze this image of a school/college class timetable. 
      Extract the schedule and format it STRICTLY as a JSON object where keys are the lowercase days of the week (e.g. "monday", "tuesday"), and values are arrays of objects. 
      Each object should have "time", "subject", and "room" (or "location") properties. 
      Do not wrap the response in markdown blocks like \`\`\`json. Return only the raw JSON.
    `;

        const imageParts = [
            {
                inlineData: {
                    data: base64Image,
                    mimeType: base64MimeType
                }
            }
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        const responseText = result.response.text();

        console.log('Gemini Extracted Text:', responseText);

        let parsedData = {};
        try {
            // Clean up potential markdown formatting just in case
            let cleanJsonStr = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanJsonStr);
        } catch (parseError) {
            console.error("Failed to parse Gemini output as JSON:", parseError);
            return res.status(500).json({
                message: 'Failed to structure timetable data.',
                rawText: responseText
            });
        }

        return res.status(200).json({
            message: 'Timetable processed successfully',
            data: parsedData
        });

    } catch (error) {
        console.error('Gemini OCR Error:', error);
        return res.status(500).json({ message: 'Failed to process timetable image with AI.' });
    }
};
