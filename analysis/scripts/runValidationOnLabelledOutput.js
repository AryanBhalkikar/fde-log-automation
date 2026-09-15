import getIOUScore from "../src/validate.js";
import loadGtIntervals from "../src/loadGtIntervals.js";
import loadLabelledIntervals from "../src/loadLabelledIntervals.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dataset = process.argv[2]?.toLowerCase();

if (dataset !== "a" && dataset !== "b") {
  console.error("Please use: npm run test-validate-llm -- <a|b>");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const datasetName = `dataset_${dataset}`;
const datasetDirPath = path.resolve(scriptDir, `../../data/${datasetName}`);
const deterministicDirPath = path.resolve(
  scriptDir,
  `../../intermediate/deterministic_output/${datasetName}`
);
const labelledDirPath = path.resolve(
  scriptDir,
  `../../intermediate/llm_labelling_output/${datasetName}_2`
);
const sessionEntries = fs.readdirSync(datasetDirPath, { withFileTypes: true });
let iouSum = 0;
let sessionCount = 0;

for (const sessionEntry of sessionEntries) {
  if (!sessionEntry.isDirectory()) continue;

  const sessionName = sessionEntry.name;
  const sessionDirPath = path.join(datasetDirPath, sessionName);
  const deterministicFilePath = path.join(
    deterministicDirPath,
    `${datasetName}_${sessionName}.jsonl`
  );
  const labelledFilePath = path.join(labelledDirPath, `${sessionName}.json`);

  if (!fs.existsSync(labelledFilePath)) {
    console.log(`Session ${sessionName} labelled file does not exist. Skipping.`);
    continue;
  }
  const gtIntervals = loadGtIntervals(sessionDirPath);
  const labelledIntervals = loadLabelledIntervals(
    labelledFilePath,
    deterministicFilePath
  );
  const sessionIou = getIOUScore(gtIntervals, labelledIntervals);

  iouSum += sessionIou;
  sessionCount += 1;
  console.log(`${sessionName} IOU: ${sessionIou}`);
}

const averageIou = sessionCount > 0 ? iouSum / sessionCount : 0;
console.log(`Average IOU across ${sessionCount} sessions: ${averageIou}`);