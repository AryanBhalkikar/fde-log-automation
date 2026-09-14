import { Worker } from "bullmq";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import redisConnection from "../config/redis.js";
import buildSessionPrompt from "./prompt.js";
import "dotenv/config";

if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set.");
}

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const workerDir = path.dirname(fileURLToPath(import.meta.url));
const intermediateDir = path.resolve(workerDir, "..", "..", "intermediate");
const outputFilePath = path.join(intermediateDir, "llmLabellingOutput.json");

fs.mkdirSync(intermediateDir, { recursive: true });

const labellingWorker = new Worker('labelling-queue', async(job) => {
    try {
        const segments = job.data;
        const { systemPrompt, userContent, responseSchema } = buildSessionPrompt(segments);

        const response = await gemini.models.generateContent({
            model: "gemini-3.6-flash",
            contents: [{ role: "user", parts: [{ text: userContent }] }],
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.2,
            },
        });

        const parsedOutput = JSON.parse(response.text); 
        fs.writeFileSync(outputFilePath, JSON.stringify(parsedOutput, null, 2));
        console.log(`LLM Labelling output received.`);
        return parsedOutput;
    }
    catch (err) {
        console.error('LabellingWorker throws err:', err);
        throw err;
    }
}, {
    connection: redisConnection,
    concurrency: 1,
    limiter: {
        max: 1,
        duration: 1000 * 65,
    }
});

export default labellingWorker;