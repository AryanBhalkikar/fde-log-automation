import { Queue } from "bullmq";
import redisConnection from "../config/redis.js";

const labellingQueue = new Queue('labelling-queue', { connection: redisConnection });

async function producer(compressedSegmentedEvents){
    try {
        await labellingQueue.add('session-info', compressedSegmentedEvents);
        console.log(`Enqueued ${compressedSegmentedEvents.length} segments.`);
    }
    catch (err) {
        console.error('Producer through err:', err);
    }
}

export default producer;
