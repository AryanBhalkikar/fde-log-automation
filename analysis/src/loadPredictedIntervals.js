import { existsSync, readFileSync } from "fs";

function loadPredictedIntervals(){
    const filePath = "../intermediate/deterministicSegmentationOutput.jsonl";
    if (!existsSync(filePath)){
        console.error(`Intermediate output not found.`);
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