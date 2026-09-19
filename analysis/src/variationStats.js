import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const datasetName = "dataset_b";
const segmentedEventsDir = path.join(
	rootDir,
	"intermediate",
	"deterministic_output",
	"segmented_events",
	datasetName
);
const labelledOutputDir = path.join(
	rootDir,
	"intermediate",
	"llm_labelling_output",
	datasetName
);
fs.mkdirSync(segmentedEventsDir, { recursive: true });
fs.mkdirSync(labelledOutputDir, { recursive: true });

const segmentedFiles = fs.readdirSync(segmentedEventsDir)
	.filter((fileName) => fileName.endsWith(".json"))
	.sort();

function getRoute(url) {
	if (!url) return null;
	const hashIndex = url.indexOf("#");
	if (hashIndex === -1) return null;
	return url.slice(hashIndex + 1);
}

function getAppSet(actions) {
	const set = new Set();
	for (const action of actions) {
		const route = getRoute(action.url);
		const key = route ? `${action.app}:${route}` : action.app;
		if (key) set.add(key);
	}
	return set;
}

function getSimilarity(setA, setB) {
	const intersection = new Set([...setA].filter(x => setB.has(x)));
	const union = new Set([...setA, ...setB]);
	return union.size > 0 ? intersection.size / union.size : 1;
}

const instancesByLabel = new Map();

for (const fileName of segmentedFiles) {
	const sessionName = fileName.replace(`${datasetName}_`, "").replace(/\.json$/, "");
	const segmentedEventsPath = path.join(segmentedEventsDir, fileName);
	const labelledOutputPath = path.join(labelledOutputDir, `${sessionName}.json`);

	if (!fs.existsSync(labelledOutputPath)) {
		console.log(`Session ${sessionName} has no labelled output. Skipping.`);
		continue;
	}

	const segmentedEvents = JSON.parse(fs.readFileSync(segmentedEventsPath, "utf8"));
	const labelledEvents = JSON.parse(
		fs.readFileSync(labelledOutputPath, "utf8")
	).labels;

	for (let i = 0; i < labelledEvents.length; i++) {
		const { label, case_id } = labelledEvents[i];
		const actions = segmentedEvents[i];

		if (!instancesByLabel.has(label)) {
			instancesByLabel.set(label, []);
		}
		instancesByLabel.get(label).push({
			appSet: getAppSet(actions),
			sessionName,
			caseId: case_id,
		});
	}
}

function computeVariance(instances) {
	if (instances.length < 2) {
		return { instanceCount: instances.length, avgSimilarity: null };
	}

	let totalSim = 0;
	let pairCount = 0;
	for (let i = 0; i < instances.length; i++) {
		for (let j = i + 1; j < instances.length; j++) {
			totalSim += getSimilarity(instances[i].appSet, instances[j].appSet);
			pairCount++;
		}
	}

	return {
		instanceCount: instances.length,
		avgSimilarity: totalSim / pairCount,
	};
}

const varianceResults = [...instancesByLabel.entries()]
	.map(([label, instances]) => ({
		label,
		...computeVariance(instances),
	}))
	.filter(r => r.avgSimilarity !== null)
	.sort((a, b) => b.instanceCount - a.instanceCount);

console.log(varianceResults);