import fs, { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

function toMs(isoOrUtcString) {
    return new Date(isoOrUtcString).getTime();
}

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '../..');
const inputDir = path.join(rootDir, 'intermediate', 'llm_labelling_output', 'dataset_b');
fs.mkdirSync(inputDir, { recursive: true });
const inputFiles = fs.readdirSync(inputDir).filter((fileName) => fileName.endsWith('.json'));

const finalOutputSegments = [];

for (const fileName of inputFiles){
    const filePath = path.join(inputDir, fileName);
    const sessionId = path.basename(fileName, '.json');
    mergeIntervals(sessionId, filePath);
}

const outputDir = path.join(rootDir, 'output');
const outputFilePath = path.join(outputDir, 'segments.jsonl');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(
    outputFilePath,
    finalOutputSegments.map((segment) => JSON.stringify(segment)).join('\n') + '\n'
);
console.log('Final segments.jsonl generated.');

function mergeIntervals(sessionId, llmFilePath){
    const llmRawContent = readFileSync(llmFilePath, 'utf-8');
    const llmIntervals = JSON.parse(llmRawContent).labels;
    
    const deterministicSessionDir = path.join(rootDir, 'intermediate', 'deterministic_output', 'dataset_b');
    const deterministicFilePath = path.join(deterministicSessionDir, `dataset_b_${sessionId}.jsonl`);
    if (!fs.existsSync(deterministicFilePath)) {
        console.log(`Deterministic file for session ${sessionId} does not exist. Skipping.`);
        return;
    }

    const deterministicRawContent = readFileSync(deterministicFilePath, 'utf-8');
    const deterministicIntervals = deterministicRawContent
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));

    if (llmIntervals.length === 0 || deterministicIntervals.length === 0) {
        console.log(`Session ${sessionId} has empty interval data. Skipping.`);
        return;
    }
    if (llmIntervals.length !== deterministicIntervals.length) {
        console.log(`Session ${sessionId} has inconsistent interval counts. Skipping.`);
        return;
    }

    let i = 0, j = 1;
    let n = deterministicIntervals.length;
    let startf = deterministicIntervals[0].start;
    let endf = deterministicIntervals[0].end;
    let start = toMs(startf);
    let end = toMs(endf);

    while(i < n && j < n){
        if (llmIntervals[j].label === llmIntervals[i].label && 
            llmIntervals[j].continues_from_segment_index === j-1){
            endf = deterministicIntervals[j].end;
            end = toMs(endf);
            j++;
        }
        else{
            finalOutputSegments.push({
                session_id: sessionId,
                start: startf,
                end: endf,
                label: llmIntervals[i].label
            }); 
            i = j;
            startf = deterministicIntervals[i].start;
            endf = deterministicIntervals[i].end;
            start = toMs(startf);
            end = toMs(endf); 
            j++;
        }
    }
    finalOutputSegments.push({
        session_id: sessionId,
        start: startf,
        end: endf,
        label: llmIntervals[i].label
    });
}