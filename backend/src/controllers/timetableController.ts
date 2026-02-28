import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const uploadTimetable = async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image uploaded' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ message: 'Server config missing GEMINI_API_KEY.' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        console.log('Processing image with Gemini VLM...');

        // Convert multer buffer to base64 for Gemini
        const base64MimeType = req.file.mimetype;
        const base64Image = req.file.buffer.toString('base64');

        // Choose a Gemini vision-capable model and request JSON output.
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
                responseMimeType: 'application/json',
            },
        });

        const prompt = `
      Analyze this image of a school/college class timetable. 
      Extract the schedule and format it STRICTLY as a JSON object where keys are the lowercase days of the week (e.g. "monday", "tuesday"), and values are arrays of objects. 
      Each object must contain:
      - "start_time": (e.g. "09:00")
      - "end_time": (e.g. "10:00")
      - "subject": (e.g. "Mathematics")
      - "code": (e.g. "MA101")
      - "is_attendance_critical": (boolean, default false)
      
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

        const result = await Promise.race([
            model.generateContent([prompt, ...imageParts]),
            new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Gemini request timed out after 20 seconds.')), 20000);
            }),
        ]);
        const responseText = result.response.text();

        console.log('Gemini Extracted Text:', responseText);

        let parsedData: any = {};
        try {
            // Clean potential markdown formatting and stray text.
            let cleanJsonStr = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();

            // If model returned extra prose, attempt to isolate the first JSON object.
            if (!cleanJsonStr.startsWith('{')) {
                const firstBrace = cleanJsonStr.indexOf('{');
                const lastBrace = cleanJsonStr.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    cleanJsonStr = cleanJsonStr.slice(firstBrace, lastBrace + 1);
                }
            }

            parsedData = JSON.parse(cleanJsonStr);
        } catch (parseError) {
            console.error("Failed to parse Gemini output as JSON:", parseError);
            return res.status(500).json({
                message: 'Failed to structure timetable data.',
                rawText: responseText
            });
        }

        if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData)) {
            return res.status(500).json({
                message: 'Model output format invalid.',
                rawText: responseText,
            });
        }

        return res.status(200).json({
            message: 'Timetable processed successfully',
            data: parsedData
        });

    } catch (error: any) {
        console.error('Gemini OCR Error:', error);
        const errorMessage = typeof error?.message === 'string' ? error.message : 'Failed to process timetable image with AI.';
        const isTimeout = errorMessage.toLowerCase().includes('timed out');
        const isUnreadableImage = errorMessage.toLowerCase().includes('unable to process input image');

        if (isUnreadableImage) {
            return res.status(422).json({
                message: 'Gemini could not read this image. Upload a clear JPG/PNG timetable photo or screenshot.',
            });
        }

        return res.status(isTimeout ? 504 : 500).json({ message: errorMessage });
    }
};
