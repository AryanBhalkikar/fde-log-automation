**Name**: Aryan Bhalkikar  
**University**: Indian Institute of Technology Bhubaneswar  
**Department**: B.Tech, Electrical Engineering  
**Email**: aryan.bhalkikar05@gmail.com

## Overview

This project analyzes desktop operation logs to identify distinct units of work. The best candidates for automation are analysed and automated.

## Approach

The pipeline first extracts useful fields from raw events. A deterministic script is then used to determine preliminary boundaries of processes. These segments are then fed to an LLM to carry out context-aware segmentation and label the process being done. Statistics are generated from the labelled output to study the frequency and variation of the processes. The best candidates for automation are automated using Playwright.

## Directories:

- /analysis: this directory contains the code to validate segments against the ground truth in case of dataset A. It computs the IOU score of the segmented output.
- /segmentation: this directory contains the deterministic scripts for segmentation.
- /labelling: this directory handles the LLM based context-aware segmentation and labelling.
- /intermediate: this directory (gitignored) contains the deterministic segmentation and LLM labelling test outputs.
- /output: this directory contains the labelled process segments of dataset_b.
- /automation: this directory contains the Playwright automation server and webpage.

## Running the Pipeline

Replace `a` with `b` to run the other dataset.
(Note that the validation / IOU scoring part does not apply to dataset `b` as ground truth is not given).

The input data is not included in Git. Before running the pipeline, create the following format (same as dataset_a and dataset_b provided for this project):

```text
data/
└── dataset_a/ or dataset_b/
	└── <session_name>/
		└── <chunk_name>/
			└── events.jsonl
```

### Deterministic Segmentation:

1. Run segmentation:

```bash
cd segmentation
npm run test-segment -- a
```

2. Validate the deterministic segmentation (only for dataset A):

```bash
cd analysis
npm run test-validate-segment -- a
```

### LLM Based Labelling and Segmentation:

1. Start Redis in one terminal:

```bash
cd labelling
redis-server
```

2. Start the worker in another terminal and keep it running:

```bash
cd labelling
node src/worker.js
```

3. Run labelling in a third terminal:

```bash
cd labelling
npm run test-labelling -- a
```

4. Validate the labelled output (Only for dataset A):

```bash
cd analysis
npm run test-validate-llm -- a
```

### Statistics:

After the labelled output has been created, run the frequency statistics:

```bash
cd analysis
node src/frequencyStats.js
```

Run the variation statistics:

```bash
cd analysis
npm run variation-stats
```

### Running the Automation:

1. Install the dependencies:

```bash
cd automation
npm install
npx playwright install chromium
```

2. Start the automation server:

```bash
cd automation
node src/server.js
```

3. Open `http://localhost:3000` in a browser.

4. Click **Run Batch Approval**. Playwright will open a browser and process the pending requests one by one.