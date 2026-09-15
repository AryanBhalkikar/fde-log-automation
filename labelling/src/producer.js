import { Queue } from "bullmq";
import redisConnection from "../config/redis.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const labellingQueue = new Queue('labelling-queue', { connection: redisConnection });

const producerDir = path.dirname(fileURLToPath(import.meta.url));
const intermediateDir = path.resolve(producerDir, "..", "..", "intermediate");

async function producer(compressedSegmentedEvents, datasetName, sessionName){
    try {
        const outputDir = path.join(intermediateDir, "llm_labelling_output", datasetName);
        const outputFilePath = path.join(outputDir, `${sessionName}.json`);
        if (fs.existsSync(outputFilePath)) {
            console.log(`Skipping existing LLM Labelling output: ${outputFilePath}`);
            return;
        }

        await labellingQueue.add('session-info', {
            segments: compressedSegmentedEvents,
            datasetName,
            sessionName,
        },
        {
            attempts: 6,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
            removeOnComplete: true,
            removeOnFail: false,
        }
        );
        console.log(`Enqueued ${compressedSegmentedEvents.length} segments.`);
    }
    catch (err) {
        console.error('Producer through err:', err);
    }
}

export default producer;
