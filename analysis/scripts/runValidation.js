import getIOUScore from "../src/validate.js";
import loadGtIntervals from "../src/loadGtIntervals.js";
import loadPredictedIntervals from "../src/loadPredictedIntervals.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dataset = process.argv[2]?.toLowerCase();

if (dataset !== "a" && dataset !== "b") {
  console.error("Please use: npm run test-validate-segment -- <a|b>");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const datasetName = `dataset_${dataset}`;
const datasetDirPath = path.resolve(scriptDir, `../../data/${datasetName}`);
const predictionDirPath = path.resolve(
  scriptDir,
  `../../intermediate/deterministic_output/${datasetName}`
);
const sessionEntries = fs.readdirSync(datasetDirPath, { withFileTypes: true });

let iouSum = 0;
let sessionCount = 0;

for (const sessionEntry of sessionEntries) {
  if (!sessionEntry.isDirectory()) continue;

  const sessionName = sessionEntry.name;
  const sessionDirPath = path.join(datasetDirPath, sessionName);
  const predictionPath = path.join(
    predictionDirPath,
    `${datasetName}_${sessionName}.jsonl`
  );
  
  const gtIntervals = loadGtIntervals(sessionDirPath);
  const predictedIntervals = loadPredictedIntervals(predictionPath);
  const sessionIou = getIOUScore(gtIntervals, predictedIntervals);

  iouSum += sessionIou;
  sessionCount += 1;
  console.log(`${sessionName} IOU: ${sessionIou}`);
}

const averageIou = sessionCount > 0 ? iouSum / sessionCount : 0;
console.log(`Average IOU across ${sessionCount} sessions: ${averageIou}`);