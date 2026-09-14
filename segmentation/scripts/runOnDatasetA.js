import loadSessionEvents from "../src/loadSession.js";
import compress from "../src/compress.js";
import getSegments from "../src/segmentHeuristic.js";
import compressSegment from "../src/compressSegment.js";
import path from "path";
import fs from "fs";

const sessionDirPath = process.argv[2];

if (!sessionDirPath) {
  console.error("Please use: npm run test-segment-a <path-to-session-folder>");
  process.exit(1);
}

const events = await loadSessionEvents(path.resolve(sessionDirPath));

console.log(`Loaded ${events.length} events`);
console.log("First event:", events[0].timestamp_iso, events[0].event_type);
console.log("Last event:", events[events.length - 1].timestamp_iso, events[events.length - 1].event_type);

console.log(`Loaded gt_manifest.json intervals`);

// Filter and compress events to extract valuable info:

const compressedEvents = compress(events);

// boundary detection and grouping: 

const segmentedEvents = getSegments(compressedEvents);

// Compress output further to feed into LLM:

const compressedSegmentedEvents = compressSegment(segmentedEvents);

const stream1 = fs.createWriteStream('./testOutputs/compressedSegmentationOutput.jsonl');
const stream2 = fs.createWriteStream('../intermediate/deterministicSegmentationOutput.jsonl');

compressedSegmentedEvents.forEach(item => {
  const line = JSON.stringify(item) + '\n';
  stream1.write(line);
  stream2.write(line);
});

stream1.end(() => console.log('JSONL local output file successfully created!'));
stream1.end(() => console.log('JSONL output file successfully created!'));