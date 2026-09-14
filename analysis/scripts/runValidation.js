import getIOUScore from "../src/validate.js";
import loadGtIntervals from "../src/loadGtIntervals.js";
import loadPredictedIntervals from "../src/loadPredictedIntervals.js";

const sessionDirPath = process.argv[2];

if (!sessionDirPath) {
  console.error("Please use: npm run test-validate-a <path-to-session-folder>");
  process.exit(1);
}

const gtIntervals = loadGtIntervals(sessionDirPath);
const compressedSegmentedEvents = loadPredictedIntervals();

const avgIou = getIOUScore(gtIntervals, compressedSegmentedEvents);

console.log(`Average IOU score: ${avgIou}`);