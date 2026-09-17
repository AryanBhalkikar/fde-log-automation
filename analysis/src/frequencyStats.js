import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '../..');
const inputFilePath = path.join(rootDir, 'output', 'segments.jsonl');

if (!existsSync(inputFilePath)) {
    console.error(`segments.jsonl not found at: ${inputFilePath}`);
    process.exit(1);
}

const rawContent = readFileSync(inputFilePath, 'utf-8');
const segments = rawContent
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));

const frequencyDurationMap = new Map();

for (const segment of segments){
    const start = toMs(segment.start);
    const end = toMs(segment.end);
    const label = segment.label;
    
    const [count, duration] = frequencyDurationMap.get(label) ?? [0,0];
    frequencyDurationMap.set(label, [count + 1, duration + (end - start)]);
}

const mapSortByFrequency = [...frequencyDurationMap].sort((a, b) => {
    const countA = a[1][0];
    const countB = b[1][0];
    return countB - countA;
});

const mapSortByDuration = [...frequencyDurationMap].sort((a, b) => {
    const countA = a[1][1];
    const countB = b[1][1];
    return countB - countA;
});

console.log([...mapSortByFrequency]);
console.log([...mapSortByDuration]);


function toMs(isoOrUtcString) {
    return new Date(isoOrUtcString).getTime();
}