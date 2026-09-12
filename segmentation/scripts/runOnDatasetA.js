import loadSessionEvents from "../src/loadSession.js";
import compress from "../src/compress.js";
import getSegments from "../src/segmentHeuristic.js";
import compressSegment from "../src/compressSegment.js";
import path from "path";
import fs from "fs";

const sessionDirPath = process.argv[2];

if (!sessionDirPath) {
  console.error("Please use: npm run test-a <path-to-session-folder>");
  process.exit(1);
}

const events = await loadSessionEvents(path.resolve(sessionDirPath));
const compressedEvents = compress(events);

console.log(`Loaded ${events.length} events`);
console.log("First event:", events[0].timestamp_iso, events[0].event_type);
console.log("Last event:", events[events.length - 1].timestamp_iso, events[events.length - 1].event_type);

// Filter and compress events to extract valuable info:

const compressionStream = fs.createWriteStream('./testOutputs/compressionOutput.jsonl');

compressedEvents.forEach(item => {
  compressionStream.write(JSON.stringify(item) + '\n');
});

compressionStream.end(() => console.log('JSONL compression output file successfully created!'));

// boundary detection and grouping: 

const segmentedEvents = getSegments(compressedEvents);

const segmentaionStream = fs.createWriteStream('./testOutputs/segmentationOutput.jsonl');

segmentedEvents.forEach(item => {
  segmentaionStream.write(JSON.stringify(item) + '\n');
});

segmentaionStream.end(() => console.log('JSONL segmentation output file successfully created!'));

// Compress output further to feed into LLM:

const compressedSegmentedEvents = compressSegment(segmentedEvents);

const compressedSegmentationStream = fs.createWriteStream('./testOutputs/compressedSegmentationOutput.jsonl');

compressedSegmentedEvents.forEach(item => {
  compressedSegmentationStream.write(JSON.stringify(item) + '\n');
});

compressedSegmentationStream.end(() => console.log('JSONL compressed segmented output file successfully created!'));