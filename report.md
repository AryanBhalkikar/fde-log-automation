# Final Report

## 1. Step 1: Recovering Units of Work from the Logs

### Approach

- Two stages were used: a deterministic script and an LLM.
- A deterministic pipeline reconstructed sessions from chunks, compressed the raw events and found likely task boundaries. The most informative data fields was retained. The candidate boundaries were detected using several signals together (time gap, app change, window title change, route change).
- Labelling and grouping tasks of the same kind needs language understanding, so this was handled by an LLM. The candidate boundries along with context (like on-screen text, app/window/route names, clicked DOM elements, etc.) were given to the LLM to perform labelling and further segmentation. 
- Reasoning: exact timestamps should never depend on an LLM, since LLMs are not reliable with precise numbers. But recognising the same kind of task is a judgement call. Hence an LLM is used here.

The pipeline:

1. Reconstruct complete sessions from chunks.
2. Normalise and compress the low level events.
3. Use several signals like time gap, app change, window title change and route change to determine candidate boundaries. Different weights are given to each signal.
4. Use an LLM to label and group the candidate segments.
5. Tune the signal weights against ground truth of Dataset A.
6. Apply the final pipeline to Dataset B.

The segmentation was deliberately over segmented on purpose in the deterministic pipeline. It is much easier to merge two segments that turn out to be one real task than to recover a boundary that was never detected. The LLM merge step cleans up this over segmentation using a field that flags when a segment continues an earlier one.

**Scope decision:** only segments that are next to each other are merged. A task that gets interrupted and picked up much later, after unrelated work in between, is not merged automatically. This was left out on purpose, since a merged interval with unrelated activity inside it would make both the automation and the scoring harder.

### Alternatives considered and rejected

- Using an LLM on the complete raw log: too expensive, noisy and hard to evaluate precisely.
- A deterministic script only: does not scale well and cannot understand context.
- Segmenting only by time gap: not reliable, since pauses can happen in the middle of one task.
- Segmenting only by application switch: also not reliable, since a worker can switch apps while still doing the same task (eg: copy pasting).

### Validation and Results

- Validation and analysis was done for Dataset A against its given ground truth.
- For each true execution, the best matching predicted segment was found and IoU (Intersection over Union) was calculated. The average of all these was taken rather than one single score for the whole session so that each execution is judged fairly.
- The deterministic script alone gave an average IoU of around **0.48**.
- After the LLM based merging, this went up to around **0.61**.
- This improvement shows that the two stage design was effective. 
- A larger LLM model gave better results (around 0.68) but its rate limits were too low to run on the whole dataset in the time available. A smaller and faster model was used instead so that the full dataset could be processed. This was a tradeoff between accuracy and scalability.

### Limitations

- A few ground truth executions had `end_ts` set to null (the task was likely still in progress when the recording stopped). These were skipped rather than scored, which is a small known gap in the validation.
- The portal reuses one generic screen pattern (click a row, fill a note, paste, confirm) across several different business processes. This caused some labelling confusion between different processes that look identical from the outside (for example, leave approval and expense approval were confused with each other in a few cases). This was found while preparing data for Step 3.
- One API call was made for each session to complete the labelling of that session. Due to API rate limits, data from across sessions could not be combined into a single call. This caused some inconsistancy of label names for the same process across different sessions. 

---

## 2. Step 2: Analysis and Automation Candidates

### What was measured for each label

- Number of executions (frequency).
- Total time spent and average time per execution.
- Consistency between executions of the same label.

### How consistency was measured

- The first attempt compared the exact order of apps and routes visited in each execution. This did not work well, since workers rarely follow the exact same sequence every time, so even small differences gave a very low similarity score.
- This approach was dropped in favour of a set based comparison: for each execution, the distinct apps and routes touched are collected into a set. Two executions of the same label are then compared using Jaccard Similarity:

  `similarity = size of intersection / size of union`

- This is a fairer measure of "do these two executions use the same systems", regardless of small ordering differences.
- A higher similarity score implies a more repetitive and structured processes, while a lower similarity score indicates more variation in the way the process is carried out.

### Ranked candidates

The following is a few lines of the result of analysing automation candidates:

| Process | Executions | Total Time (min) | Avg. Similarity |
|---|---:|---:|---:|
| invoice_reconciliation | 21 | 17.2 | 0.495 |
| contract_management | 14 | 15.3 | 0.595 |
| leave_application_approval | 17 | 11.5 | 0.718 |
| social_insurance_processing | 12 | 12.9 | 0.446 |
| onboarding_verification | 8 | 8.8 | 0.791 |

### Why leave_application_approval was chosen

- It has a decent number of executions and a meaningful amount of total time spent, so automating it would have a real impact.
- Its similarity score is high (0.718), which means different executions tend to follow a similar structure. A highly repetitive process like this is much easier and safer to automate with a deterministic script.
- `invoice_reconciliation` and `contract_management` have more total time and executions, but a lower similarity score. This implies more branching or case by case handling. Automating these safely would likely need more time (possibly an LLM based agent) than was available, so they are recommended as candidates for a later phase rather than this prototype.

---

## 3. Step 3: What Was Built

### Evidence gathered before deciding the approach

- Real examples of `leave_application_approval` were read directly before deciding anything.
- 100% of the resolution messages found in the data was exactly the same sentence ("no issues, approved."). No rejections or escalations were found anywhere in the sample.
- The only part that changes between cases is the leave type and the date. These are case details that exist before any approval happens and not the output of a human decision.

Due to this a deterministic script was chosen instead of an AI agent. Since there is no real decision being made at this step, an agent would only add cost and unpredictability without solving anything a script cannot.

### What was built

- A mock web page (HTML, CSS and JavaScript) that copies the structure seen in the real logs: a table of leave requests, a note field, and a confirm button, following the same interaction pattern observed (click a row, fill the note, click OK).
- A Playwright script that reads each pending request's type and date, fills the approval message using the same template seen in the data (with `{type}` and `{date}` replaced), enters it, and clicks OK. It repeats this until all pending requests are processed.
- A small Express server with an endpoint that runs the Playwright script, triggered by a button on the page itself.

### Decision Logic

In a company environment, leave approvals typically involve two layers:
1. **Rule-Based Validation (Deterministic):** Checking leave balance, verifying non-conflict dates, and ensuring required notice periods.
2. **Subjective Judgment (Human-in-the-Loop):** Evaluating special circumstances or approving exceptions.

The telemetry log analysis revealed that 100% of the sampled requests followed a standard path with uniform resolution notes.
- **Automated Processing:** Requests meeting standard structural rules are batch-processed with the boilerplate template.
- **Exception Routing (Future Scope):** Any request flagged with unusual notes, zero leave balance, or system conflicts bypasses the auto-approver and is highlighted in the UI control panel for manual manager review.

### Scope

- This prototype covers one process, `leave_application_approval`.
- Given the time available, it made more sense to finish one well evidenced, working prototype than to attempt a broader system and risk not finishing it, since an unfinished broad system gives no real value to the client.

### What is real vs mocked in the prototype

- Real: the leave types and dates used to seed the demo table were taken directly from the on screen text captured in Dataset B, not invented.
- Mocked: the employee identity shown is just a placeholder serial number. The data reliably showed only the approving manager's name and not the applicant's. The web page itself is a stand in for the real company portal, since there was no access to the actual production system.

---

## 4. Manual Work Remaining and Realistic Impact

- For the pattern observed (a leave request reaching the approval screen with no complications), the prototype removes the need for a human to read, type or click anything.
- What is not covered: any rejection, escalation or exception path, since none appeared in the sample.
- The realistic impact should be read against the sample size used, around 17 usable examples out of roughly 30 labelled occurrences in a 15 session dataset. The pattern looks consistent, but a much larger sample would be needed before assuming this holds at full production scale.

---

## 5. Risks and Mitigation

| Risk | Evidence for this risk | Suggested mitigation |
|---|---|---|
| A rejection or escalation path exists in production but was never seen in the sample | Zero rejections found across every matched instance | Any case that does not match the expected message pattern should go to a human, not get approved automatically |
| Some leave types or message formats were missed in this sample | 17 of around 30 instances had usable on screen text to extract from | Log and flag anything the script cannot parse, instead of skipping |
| The mock page does not reflect what the real system needs | No access to the real production system was available during this task | A real rollout would need proper integration with the actual system (API access or credentials) |
| The same generic screen pattern is shared across several processes | Expense approval cases were found mislabelled as leave approval during Step 3 | Before using this more broadly, add a check (such as a case ID prefix) so the script only acts on the correct kind of request |

---

## 6. Time Allocation

- **Day 1 to 2:** Manually checking Dataset A against its ground truth, then building the parsing, compression and segmentation pipeline.
- **Day 3:** Tuning the boundary heuristic and measuring IoU against Dataset A.
- **Day 4:** Building the LLM labelling and merge detection pipeline, and re checking IoU with merging applied.
- **Day 5:** Running the pipeline on the full datasets, producing `segments.jsonl`, and doing the Step 2 analysis (frequency, duration, similarity, ranking).
- **Day 6 to 7:** Building the Step 3 prototype (web page, Playwright script, server), and writing the report and work log.

Further tuning of the deterministic segmentation was stopped once it started giving diminishing returns, so that enough time was left for a properly evidenced Step 3 prototype.

---

## 7. Use of Generative AI

- An LLM (Gemini 3.5 Flash Lite) is a core part of the Step 1 pipeline. It was used for labelling segments and detecting when a task was interrupted and resumed. It is not used for boundary detection or timestamps.
- Generative AI was also used as a coding and debugging assistant. For example catching bugs in the merging and scoring logic and helping reason through choices such as which mathematical tools / metrics would be best for validation. See the work log for specific examples.