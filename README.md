**Name**: Aryan Bhalkikar  
**University**: Indian Institute of Technology Bhubaneswar  
**Department**: B.Tech, Electrical Engineering  
**Email**: aryan.bhalkikar05@gmail.com

## Overview

This project analyzes desktop operation logs to identify distinct units of work and find processes that could be automated.

## Approach

The pipeline first extracts useful fields from raw events. A deterministic script is then used to determine preliminary boundaries of processes. These segments are then fed to an LLM to carry out context-aware segmentation and label the process being done. Further parts of the project are under development.

## Directories:

- /analysis: this directory contains the code to validate segments against the ground truth in case of dataset A. It computs the IOU score of the segmented output.
- /segmentation: this directory contains the deterministic scripts for segmentation.
- /labelling: this directory handles the LLM based context-aware segmentation and labelling.

## Running the Pipeline

Replace `a` with `b` to run the other dataset.
(Note that the validation / IOU scoring part does not apply to dataset `b` as ground truth is not given).

1. Run segmentation:

```bash
cd segmentation
npm run test-segment -- a
```

2. Validate the deterministic segmentation:

```bash
cd analysis
npm run test-validate-segment -- a
```

3. Start Redis in one terminal:

```bash
cd labelling
redis-server
```

4. Start the worker in another terminal and keep it running:

```bash
cd labelling
node src/worker.js
```

5. Run labelling in a third terminal:

```bash
cd labelling
npm run test-labelling -- a
```

6. Validate the labelled output:

```bash
cd analysis
npm run test-validate-llm -- a
```