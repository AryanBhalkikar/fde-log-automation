import loadSessionEvents from "../src/loadSession.js";
import compress from "../src/compress.js";
import getSegments from "../src/segmentHeuristic.js";
import compressSegment from "../src/compressSegment.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const dataset = process.argv[2]?.toLowerCase();

if (dataset !== "a" && dataset !== "b") {
  console.error("Please use: npm run test-segment -- <a|b>");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const datasetName = `dataset_${dataset}`;
const datasetDirPath = path.resolve(scriptDir, `../../data/${datasetName}`);
const outputDirPath = path.resolve(scriptDir, `../../intermediate/deterministic_output/${datasetName}`);

fs.mkdirSync(outputDirPath, { recursive: true });

const sessionEntries = fs.readdirSync(datasetDirPath, { withFileTypes: true });

for (const sessionEntry of sessionEntries) {
  if (!sessionEntry.isDirectory()) continue;

  const sessionName = sessionEntry.name;
  const sessionDirPath = path.join(datasetDirPath, sessionName);
  const events = await loadSessionEvents(sessionDirPath);

  console.log(`\nProcessing ${datasetName}/${sessionName}`);
  console.log(`Loaded ${events.length} events`);

  if (events.length === 0) {
    console.warn("Skipping session because it contains no events.");
    continue;
  }

  console.log("First event:", events[0].timestamp_iso, events[0].event_type);
  console.log("Last event:", events[events.length - 1].timestamp_iso, events[events.length - 1].event_type);

  // Filter and compress events to extract valuable info:
  const compressedEvents = compress(events);

  // boundary detection and grouping:
  const segmentedEvents = getSegments(compressedEvents);

  // Compress output further to feed into LLM:
  const compressedSegmentedEvents = compressSegment(segmentedEvents);

  
  const outputPath = path.join(
    outputDirPath,
    `${datasetName}_${sessionName}.jsonl`
  );

  const output = compressedSegmentedEvents
    .map(item => JSON.stringify(item))
    .join("\n");

  fs.writeFileSync(outputPath, output ? `${output}\n` : "");
  console.log(`JSONL output file successfully created: ${outputPath}`);
}
