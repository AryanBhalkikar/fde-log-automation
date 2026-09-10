## Day 1: Designing the Approach

### Objective:

Creating an approach for converting low-level operation logs into segments that give information about the business process being done.

### Design:

The above goal is approached by using a combination of deterministic scripts and LLM APIs. 

- Boundary-finding and determining where a task starts and stops is mostly mechanical work and is handled by deterministic scripts. 
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

