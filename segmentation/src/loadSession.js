import fs from "fs/promises";
import path from "path";
import readline from "readline";
import { existsSync, createReadStream } from "fs";

async function loadSessionEvents(sessionDirPath){

    const events = [];

    const chunks = await fs.readdir(sessionDirPath, { withFileTypes: true });

    for (const chunk of chunks){
        if (!chunk.isDirectory()) continue;

        const filePath = path.join(
            sessionDirPath,
            chunk.name,
            "events.jsonl"
        );

        if (!existsSync(filePath)){
            console.warn(`Skipping chunk ${chunk.name}: events.jsonl missing.`);
            continue;
        }

        const rl = readline.createInterface({
            input: createReadStream(filePath),
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            if (!line.trim()) continue;
            events.push(JSON.parse(line));
        }
    }

    events.sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    return events;
}

export default loadSessionEvents;