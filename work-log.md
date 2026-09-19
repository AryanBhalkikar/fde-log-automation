## 10 Sep 26: Designing the Approach

### Objective:

Creating an approach for converting low-level operation logs into segments that give information about the business process being done.

### Design:

The above goal is approached by using a combination of deterministic scripts and LLM APIs. 

- Boundary-finding and determining when a task starts and stops is mostly mechanical work and is handled by deterministic scripts. 
- Labeling, grouping or identifying same kind of tasks benefits from an LLM's language and pattern understanding. Hence, this is handled through an LLM. 

The pipeline is:

1. Reconstruct complete sessions from chunks.
2. Normalize and compress low-level events.
3. Detect candidate boundaries using multiple behavioral signals.
4. Use an LLM to interpret candidate blocks.
5. Tune the signal weights against Dataset A.
6. Apply the pipeline to Dataset B.

### Why This Approach:
- **Session reconstruction first:** chunks are recording artifacts not business boundaries.
- **Normalization before segmentation:** raw keystrokes and mouse actions are too granular.
- **Multiple boundary signals:** no individual signal is reliable enough, for example, an application switch can occur while the worker is still performing the same process.
- **Heuristics + LLM rather than LLM-only:** heuristics reduce the search space and provide reproducible candidate boundaries. The LLM is better at interpreting meaning from context.

### Alternatives Considered
- **LLM is used over the complete log:** too expensive, noisy and difficult to evaluate precisely.
- **Deterministic script only:** does not scale to thousands of Dataset B events.
- **Segmentation based on time gap:** not reliable enough because pauses can occur within a process.
- **Segmentation based on application switch:** low reliability since workers may switch applications within one process.

### Next Step
Implement session reconstruction and inspect real Dataset A event patterns.


## 11 Sep 26: Event Compression

### Objective
Reduce the events.jsonl data to a compact representation while preserving useful information for downstream process segmentation.

### What I Did
Implemented an event-compression layer that:

- Separates events into mergeable and standalone categories.
- Merges consecutive keystrokes, mouse actions, and browser clicks when their app, window, and field context remains the same.
- Reconstructs text input from keystrokes, including backspaces and Enter/submission.
- Converts keyboard shortcuts into single 'shortcut' events.
- Removes key-release events and redundant app-switch events where the process did not actually change.
- Retains relevant context and payloads such as application, window title, URL, screen text, clicked elements, form fields, clipboard content, and app transitions.

### Why
The raw logs are too granular for analysis. Keeping individual keystrokes and clicks separately would add noise and increase the amount of data passed to later stages.

The goal is to compress the representation while keeping the information. The signals that may help identify what the user was doing and where the context changed are preserved and repetitive low-level events are removed.

The current implementation reduces approximately 2,800 raw events to ~850 events (~70% reduction).

### Generative AI Use
Generative AI was used to help scan and determine the most important fields from the large amounts of data present in dataset_a. 

### Next
Use the compressed events as the input to boundary detection and evaluate whether important process-level signals were preserved.


## 12 Sep 26: Heuristic Segmentation & LLM Input Preparation

### Objective
Build the segmentation layer and convert each segment into a compact representation suitable for LLM interpretation.

### What I Did
- Implemented a boundary score using four signals:
  - time gap
  - application change
  - window-title change
  - browser route change
- The segmentation is based on threshold that splits the compressed event when the combined score reaches 6.
- Implemented a second compression layer that converts each segment into a human-readable timeline containing:
  - duration and event count
  - application/window/URL context changes
  - typed text and form inputs
  - shortcuts and browser clicks
  - clipboard activity
  - dialogs
  - available screen text
- Added a test pipeline for Dataset A that runs the full sequence:
  loading to event compression to segmentation to LLM-oriented compression.
- Saved each compression stage as JSONL to make allow inspecting the stages.

### Why
I chose a boundary score based on multiple signals rather than a single one because no single signal can represent a business-process boundary reliably.

The scoring approach also allows tuning the parameters to achieve proper segmentation. The initial weights can be evaluated against Dataset A ground truth for tuning.

The second compression step is necessary because LLM does not need every low-level event. A chronological description of what changed and what the user did is given to the LLM. This reduces token usage while keeping important information intact.

### Next
Run the segmentation on Dataset A and compare the resulting boundaries with the ground truth and compute IOU (Intersection Over Union) score.


## 13 Sep 26: Heuristic Refinement and Dataset A Evaluation

### Objective

Improve the segmentation approach and build a reliable way to measure how well the predicted segments match the ground truth.

### What I Did

- Modified the boundary scoring logic to use:
  - time gaps
  - route changes
  - window title changes
  - application changes
  - form submission / dialog closure
- Changed how these signals are combined to avoid overcounting related changes.
- Added special handling for fast application switches and clipboard activity.
- Created method to quantitatively evaluate output against ground truth. 

### Evaluation

Implemented segment matching using Intersection over Union (IoU).

Instead of calculating one global IoU across the entire session, the best matching predicted segment for each ground-truth segment was calculated and then the mean was taken. This gives a better view of how well each business-process executions are being recovered. This was implemented through a two-pointer interval matching algorithm.

### Challenges Faced

- The previous heuristic was creating too many segments. For example, one application switch could also cause a window title and route change, so adding all three scores treated one real change as three separate signals. The way these different signals are combined was changed.

- I also made application switches dependent on context. For example, a very fast switch after clipboard activity is probably part of a copy-paste action within the same process.

- Some ground-truth intervals had null end timestamps, which resulted in invalid time intervals. These were being treated as zero-IoU cases and were pulling the average score down incorrectly.

- After identifying and handling these invalid intervals, the current mean IoU is approximately 0.48.

### Decisions

At this point, further tuning of deterministic thresholds is giving diminishing returns. The remaining mismatches in overlap are difficult to solve using only time and application-level signals because deciding whether two actions belong to the same task requires understanding their context.

Therefore, I decided to move to the next stage from deterministic segmentation to LLM-based context aware grouping.

### Generative AI Use
Generative AI was used to help determine which mathematical tool or metric would be best to perform the validation. The IOU algorithm was determined to be the best suited. 

### Next

Use the compressed event timelines as input to an LLM and evaluate whether context-aware task identification and grouping can improve the IoU on Dataset A.


## 14 Sep 26: LLM-Based Context-Aware Labelling

### Objective

Move from deterministic segmentation to context-aware task identification using an LLM.

### What I Did

- Restructured the project into separate components for:
  - mathematical analysis and validation
  - deterministic processing
  - LLM-based labelling
- Added a BullMQ producer/worker pipeline to send compressed session segments to the LLM asynchronously.
- Added rate limiting so LLM requests can be throttled and concurrency can be increased later if required.
- Designed the LLM prompt to identify:
  - a consistent process label
  - case IDs
  - whether a segment resumes an earlier task
  - confidence
  - unclear/noise segments
- Successfully received descriptive labels from the LLM and identified cases where a process was paused and later resumed.

### Why

The deterministic scripts have a limit to how useful they are since they rely on fixed time-based or specific action-based signals. The LLM can use the combination of information as well as screen text to determine whether different segments belong to the same task.

BullMQ separates LLM execution from the main processing. This makes rate limiting and asynchronous processing possible.

### Main Challenge

The main constraint was the LLM token limit. The input must have the signals most useful for identifying tasks while removing redundant or low-value details. This makes deciding which information to use an important part of the pipeline rather than sending more data to the model.

### Next

Validate the LLM labels and task resumption decisions against Dataset A ground truth using the IoU-based evaluation.


## 15 Sept 26: Full Dataset Pipeline and Automation Planning:

### Objective

Make the complete pipeline run across all sessions and evaluate whether LLM-based processing improves segmentation quality at dataset level.

### What I Did

- Extended the pipeline to process every session in a dataset rather than testing individual sessions.
- Calculated the average IoU across all sessions before and after LLM-based processing.
- The average IoU increased from the deterministic approach to 0.61 after LLM processing, showing an  improvement from adding context-based processing.

### Challenge

The IoU score was affected by the size of the LLM used. Larger models achieved scores of around 0.68 on average, but their API token limits were too low for processing all sessions.

I had to use smaller models which were less accurate but within the API limits. This caused a trade-off between segmentation accuracy and scalability.

### Automation Planning

The next stage is to analyse Dataset B and rank processes based on how suitable they are for automation.

The main factors will be:

- **Total time spent:** How much staff time is spent on the task overall. More time means more ROI.
- **Frequency:** How often the task is performed. Frequent tasks imply more ROI.
- **Duration variation:** How much execution time changes between cases. Low variation suggests a predictable process and high variation may indicate exceptions or decision-making.
- **Application-switch frequency:** How often workers move between applications during one execution. Frequent switching can indicate repetitive movement or copy-pasting. RPA could be used here.

Highly frequent and low variation tasks are good for deterministic scripts, while tasks with large variation may require more context-aware or LLM-based automation because the worker may be making decisions or handling exceptions.

### Generative AI Use
Generative AI was used as a coding assistant to help expand the pipeline to include all sessions. This ensured that data transfer between the segmentation and labelling packages was consistant and directory paths were correct.

### Next

Run this automation analysis on Dataset B and identify the highest-value feasible automation candidates.


## 16 Sept 26: Process Frequency, Duration and Variation Analysis:

### Objective

Start analysing the identified processes in Dataset B to determine which ones should receive higher automation priority and also identify the best method of automation.

### What I Did

- Calculated the execution count and total time spent for every process label.
- Used these measures as an initial way to identify high-impact processes. Processes that occur more often and consume more total time represent more potential value from automation.

### Process Variation Analysis

I first tried to measure variation by creating an ordered execution path for each process, based on the main apps and routes and URLs used.

I then compared the paths of different segments with the same label to determine how consistently the process followed the same sequence.

### Challenge Faced

This approach was too sensitive to small differences in execution order. A process could follow almost the same workflow but have one minor deviation, causing the complete path comparison to give a very low similarity score. Since people generally do not follow a strict sequence of operations while working, this method was not effective in determining the similarity score of a process.

### Decision

The ordered-path approach was dropped.

Instead, I plan to represent each execution using a set of the main applications and routes/URLs involved. Executions with the same label can then be compared based on the overlap of these sets.

This removes dependence on execution order and should better capture if two executions use the same systems even when the worker performs some steps in a different order or with minor deviations. 

### Next

Implement the set-based similarity measure and use it with frequency and total duration to identify the strongest automation candidates and automation methods.


## 17 Sept 2026: Process Variation Analysis Using Set Similarity

### Objective

Measure how consistent different executions of the same process are.

### What I Did

- Implemented a set-based representation of each process using the main app and route combinations involved.
- Grouped all executions by their LLM-generated label.
- Compared executions with the same label using:

  `similarity = intersection / union`

- Calculated the average pairwise similarity for each process.
- Generated variation statistics for Dataset B, including the number of executions for each label and their average similarity.

### Why

In this method, two executions are considered similar when they involve mostly similar applications and routes. This gives a better idea of process consistency and can help identify highly standardized processes versus processes with greater variation.

### Next

Combine process frequency, total time consumed, and process similarity to identify and prioritize the most promising automation candidates.


## 18 Sept 2026: Automation Candidate Selection and Prototype

### Objective

Use the Dataset B process analysis to select a automation process and start building its prototype.

### Candidate Analysis

I compared processes using frequency, total time consumed and the similarity between executions of the same process. The following are some of the statistics observed:

| Process | Executions | Total Time (min) | Avg. Similarity |
|---|---:|---:|---:|
| invoice_reconciliation | 21 | 17.2 | 0.495 |
| contract_management | 14 | 15.3 | 0.595 |
| leave_application_approval | 17 | 11.5 | 0.718 |
| social_insurance_processing | 12 | 12.9 | 0.446 |
| onboarding_verification | 8 | 8.8 | 0.791 |

### Decision

I selected leave_application_approval as the automation candidate.

It has a relatively high number of executions and total time consumption. Hence automation could affect a meaningful amount of work. Its similarity score is high, indicating that different executions tend to follow a similar structure.

This combination is useful because a highly repetitive process is easier to automate with a deterministic script. Therefore, automating this process offers a good ROI to the client.

### Prototype

I decided to build a leave-approval web page and automate it using playwright.

The prototype interface and workflow were based on information observed in Dataset B. This includes browser clicks, DOM element information, screen text, application/window names and URLs. The leave application details and approval messages were also taken from the screen information observed in the dataset.

### Why This Approach

Using a Playwright script is appropriate for this process because the observed workflow is browser-based and relatively consistent. A deterministic browser automation also avoids introducing unnecessary LLM complexity since the process appears standardized.

### Generative AI Use
Generative AI was used to build and design the webpage HTML and CSS. 

### Next

Complete the Playwright automation and test it on representative leave applications.


## 19 Sept 2026: Playwright Automation Prototype

### Objective

Turn the workflow into a working automated script based on the observations from Dataset B.

### What I Did

- Implemented the Playwright automation for the leave approval page.
- The script reads the leave type and date for each pending request.
- It fills the approval message using the same template observed in Dataset B, replacing '{type}' and '{date}' with the request values.
- It enters the message into the approval field and clicks 'OK'. This is consistant with the workflow observed in dataset_b's data.
- Added batch processing so the script continues until all pending requests are completed.
- Updated report.md

### Why

The workflow for leave_application_approval observed in Dataset B is repetitive and browser-based, making it a good fit for deterministic browser automation. The prototype does not need an LLM since the observed steps and approval response can be reproduced using fixed rules.

A particularly important finding was that 100% of the observed resolution text in Dataset B was the same fixed boilerplate approval message ("...no issues, approved"). This shows that the approval response does not vary based on the individual case, further supporting deterministic automation.

### Result

The Playwright script is working successfully and can process the leave applications automatically from the page.

### Next

Test the prototype against the observed workflow, document what manual work remains and ROI.