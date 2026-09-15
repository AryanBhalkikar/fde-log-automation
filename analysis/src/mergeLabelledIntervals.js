function toMs(isoOrUtcString) {
    return new Date(isoOrUtcString).getTime();
}

function mergeLabelledIntervals(labelledOutputEntries, deterministicIntervals){
    if (labelledOutputEntries.length === 0 || deterministicIntervals.length === 0){
        console.log(`Labelled output is empty. Skipping session.`);
        return;
    }
    if (labelledOutputEntries.length !== deterministicIntervals.length){
        console.log(`LLM output size inconsistant. Skipping session.`);
        return;
    }

    let i = 0, j = 1;
    let n = labelledOutputEntries.length;
    let start = toMs(deterministicIntervals[0].start);
    let end = toMs(deterministicIntervals[0].end);

    const labelledIntervals = [];

    while(i < n && j < n){
        if (labelledOutputEntries[j].label === labelledOutputEntries[i].label && 
            labelledOutputEntries[j].continues_from_segment_index === j-1){
            end = toMs(deterministicIntervals[j].end);
            j++;
        }
        else{
            labelledIntervals.push({
                start: start,
                end: end,
                ...labelledOutputEntries[i]
            }); 
            i = j;
            start = toMs(deterministicIntervals[i].start);
            end = toMs(deterministicIntervals[i].end); 
            j++;
        }
    }
    labelledIntervals.push({
        start: start,
        end: end,
        ...labelledOutputEntries[i]
    });

    return labelledIntervals;
}

export default mergeLabelledIntervals;