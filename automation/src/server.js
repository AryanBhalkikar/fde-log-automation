import express from "express";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import path from "path";
import runAutoApproval from "./playwrightScript.js";

const app = express();
const port = 3000;

const currentFile = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(currentFile), '../..');
const htmlFilePath = path.join(rootDir, "automation", "public", "index.html");

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
    res.sendFile(htmlFilePath);
});

app.post("/api/autoApprove", async (req, res) => {
    const { targetURL } = req.body;
    if (!targetURL) {
        return res.status(400).send({ message: "targetURL is required" });
    }
    try {
        const result = await runAutoApproval(targetURL);
        res.status(200).send({ message: "Completed", ...result });
    } catch (err) {
        console.error("Auto-approval failed:", err);
        res.status(500).send({ message: "Auto-approval failed", error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});