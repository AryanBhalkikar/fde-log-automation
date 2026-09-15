const SYSTEM_PROMPT = `You are analyzing activity logs from office workers at a Japanese company.

You will be given a list of activity segments from ONE work session in chronological order. Each segment is a compressed timeline of what the worker did: which apps/windows/URLs were active, what they typed, clicked, copied and any text visible on screen (may be Japanese).
Your job is to infer what task was being done in each segment by analysing the data given to you.

For each segment, give:
1. "label": a short, consistent, snake_case name for the business process this segment represents (e.g. "resident_tax_check", "payroll_adjustment", etc.). The SAME kind of task must always get the SAME label within this session. If segment 3 and segment 19 are both instances of the worker checking resident tax records for different cases, they must both be labeled identically.
2. "case_id": if you can identify a specific case/record ID being worked on (often visible in field names, URLs or on-screen text, e.g. "RT-221428-001"), extract it. Use null if none is visible.
3. "continues_from_segment_index": if this segment looks like a RESUMPTION of an earlier segment's task (same case_id, same apparent process, picking back up after the worker did something else in between), give that earlier segment's index. Otherwise null. Do NOT use this for segments that are simply another instance of the same recurring process on a DIFFERENT case. Only for genuine interruption/resumption of the exact same case. If a segment looks like a CONTINUATION of the previous segment, assign it the index of previous segment.
4. "confidence": "high", "medium" or "low" based on how clear the evidence is.

Respond only with JSON matching the provided schema.`;

function buildSessionPrompt(segments) {
    const segmentBlocks = segments.map((seg, i) => {
        return `Segment ${i} (${seg.start} to ${seg.end}):\n${seg.timeline.join('\n')}`;
    }).join('\n\n---\n\n');

    const userContent = `Total segments: ${segments.length}\n\n${segmentBlocks}`;

    return {
        systemPrompt: SYSTEM_PROMPT,
        userContent,
        responseSchema: {
            type: "object",
            properties: {
                labels: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            segment_index: { type: "integer" },
                            label: { type: "string" },
                            case_id: { type: "string", nullable: true },
                            continues_from_segment_index: { type: "integer", nullable: true },
                            confidence: { type: "string", enum: ["high", "medium", "low"] },
                        },
                        required: ["segment_index", "label", "case_id", "continues_from_segment_index", "confidence"],
                    },
                },
            },
            required: ["labels"],
        },
    };
}

export default buildSessionPrompt;