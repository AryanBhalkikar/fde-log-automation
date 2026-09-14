import fs from "fs/promises";
import path from "path";
import { existsSync, readFileSync } from "fs";

function toMs(isoOrUtcString) {
    return new Date(isoOrUtcString).getTime();
}

function loadGtIntervals(sessionDirPath){
    const filePath = path.join(sessionDirPath, "gt_manifest.json");

    if (!existsSync(filePath)){
        console.error(`gt_manifest.json not found in session ${sessionDirPath}`);
        process.exit(1);
    }

    const rawContent = readFileSync(filePath, 'utf-8');
    const gtManifest = JSON.parse(rawContent);

    const trueIntervals = [];
    for (const process of gtManifest.processes) {
        for (const exec of process.executions) {
            trueIntervals.push({
                start: toMs(exec.start_ts),
                end: toMs(exec.end_ts),
                code: exec.code,
                case_id: exec.case_id,
                split_id: exec.split_id,
                exec_id: exec.exec_id,
            });
        }
    }

    return trueIntervals;
}

export default loadGtIntervals;