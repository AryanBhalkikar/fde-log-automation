import { existsSync, readFileSync } from "fs";

function loadPredictedIntervals(filePath){
    if (!existsSync(filePath)){
        console.error(`Intermediate output not found: ${filePath}`);
        process.exit(1);
    }

    const rawContent = readFileSync(filePath, 'utf-8');
    const compressedSegmentedEvents = rawContent
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
    return compressedSegmentedEvents;
}

export default loadPredictedIntervals;