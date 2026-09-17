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
- Converts keyboard shortcuts into single `shortcut` events.
- Removes key-release events and redundant app-switch events where the process did not actually change.
- Retains relevant context and payloads such as application, window title, URL, screen text, clicked elements, form fields, clipboard content, and app transitions.

### Why
The raw logs are too granular for analysis. Keeping individual keystrokes and clicks separately would add noise and increase the amount of data passed to later stages.

The goal is to compress the representation while keeping the information. The signals that may help identify what the user was doing and where the context changed are preserved and repetitive low-level events are removed.

The current implementation reduces approximately 2,800 raw events to ~850 events (~70% reduction).

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
- The segmentation is based on threshold that splits the compressed event when the combined score reaches 4.
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

- Some ground-truth intervals had `null` end timestamps, which resulted in invalid time intervals. These were being treated as zero-IoU cases and were pulling the average score down incorrectly.

- After identifying and handling these invalid intervals, the current mean IoU is approximately 0.48.

### Decisions

At this point, further tuning of deterministic thresholds is giving diminishing returns. The remaining mismatches in overlap are difficult to solve using only time and application-level signals because deciding whether two actions belong to the same task requires understanding their context.

Therefore, I decided to move to the next stage from deterministic segmentation to LLM-based context aware grouping.

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

### Next

Run this automation analysis on Dataset B and identify the highest-value feasible automation candidates.