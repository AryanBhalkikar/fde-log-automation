import path from "path";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import loadPredictedIntervals from "../src/loadPredictedIntervals.js";
import mergeLabelledIntervals from "./mergeLabelledIntervals.js";

function loadLabelledIntervals(filePath, deterministicFilePath){
    const currentFile = fileURLToPath(import.meta.url);
    const rootDir = path.resolve(path.dirname(currentFile), '../..');

    if (!existsSync(filePath)) {
        console.error(`Intermediate LLM output not found at: ${filePath}`);
        process.exit(1);
    }
    if (!existsSync(deterministicFilePath)) {
        console.error(`Deterministic output not found at: ${deterministicFilePath}`);
        process.exit(1);
    }

    const rawContent = readFileSync(filePath, 'utf-8');
    const labelledOutput = JSON.parse(rawContent);
    const labelledOutputEntries = labelledOutput.labels;

    const deterministicIntervals = loadPredictedIntervals(deterministicFilePath);

    const labelledIntervals = mergeLabelledIntervals(labelledOutputEntries, deterministicIntervals);
    return labelledIntervals;
}

export default loadLabelledIntervals;