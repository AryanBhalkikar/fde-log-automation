import loadPredictedIntervals from "../src/loadPredictedIntervals.js";
import producer from "../src/producer.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dataset = process.argv[2]?.toLowerCase();

if (dataset !== "a" && dataset !== "b") {
	console.error("Please use: npm run test-labelling -- <a|b>");
	process.exit(1);
}

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '../..');
const datasetName = `dataset_${dataset}`;
const inputDir = path.join(rootDir, 'intermediate', 'deterministic_output', datasetName);
const inputFiles = fs.readdirSync(inputDir)
	.filter((fileName) => fileName.endsWith('.jsonl'))
	.sort();

for (const fileName of inputFiles) {
	const filePath = path.join(inputDir, fileName);
	const compressedSegmentedEvents = loadPredictedIntervals(filePath);
	const sessionName = fileName.replace(`${datasetName}_`, '').replace(/\.jsonl$/, '');
    
	await producer(compressedSegmentedEvents, datasetName, sessionName);
}
