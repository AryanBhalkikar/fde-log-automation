import loadSessionEvents from "../src/loadSession.js";
import compress from "../src/compress.js";
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

const stream = fs.createWriteStream('compressionOutput.jsonl');

compressedEvents.forEach(item => {
  stream.write(JSON.stringify(item) + '\n');
});

stream.end(() => console.log('JSONL output file successfully created!'));