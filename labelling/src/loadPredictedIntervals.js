import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

function loadPredictedIntervals() {
    const currentFile = fileURLToPath(import.meta.url);
    const rootDir = path.resolve(path.dirname(currentFile), '../..');
    const filePath = path.join(rootDir, 'intermediate', 'deterministicSegmentationOutput.jsonl');

    if (!existsSync(filePath)) {
        console.error(`Intermediate output not found at: ${filePath}`);
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