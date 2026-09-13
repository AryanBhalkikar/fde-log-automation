import loadSessionEvents from "../src/loadSession.js";
import compress from "../src/compress.js";
import getSegments from "../src/segmentHeuristic.js";
import compressSegment from "../src/compressSegment.js";
import loadGtIntervals from "../src/loadGtIntervals.js";
import getIOUScore from "../src/validate.js";
import path from "path";
import fs from "fs";

const sessionDirPath = process.argv[2];

if (!sessionDirPath) {
  console.error("Please use: npm run test-a <path-to-session-folder>");
  process.exit(1);
}

const events = await loadSessionEvents(path.resolve(sessionDirPath));

console.log(`Loaded ${events.length} events`);
console.log("First event:", events[0].timestamp_iso, events[0].event_type);
console.log("Last event:", events[events.length - 1].timestamp_iso, events[events.length - 1].event_type);

const gtIntervals = loadGtIntervals(sessionDirPath);

console.log(`Loaded gt_manifest.json intervals`);

// Filter and compress events to extract valuable info:

const compressedEvents = compress(events);

// boundary detection and grouping: 

const segmentedEvents = getSegments(compressedEvents);

// Compress output further to feed into LLM:

const compressedSegmentedEvents = compressSegment(segmentedEvents);

const compressedSegmentationStream = fs.createWriteStream('./testOutputs/compressedSegmentationOutput.jsonl');

compressedSegmentedEvents.forEach(item => {
  compressedSegmentationStream.write(JSON.stringify(item) + '\n');
});

compressedSegmentationStream.end(() => console.log('JSONL compressed segmented output file successfully created!'));


// Compute IOU scores for preliminary evaluation:

const avgIou = getIOUScore(gtIntervals, compressedSegmentedEvents);

console.log(`Average IOU score: ${avgIou}`);