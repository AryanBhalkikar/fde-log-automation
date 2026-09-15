function toMs(isoOrUtcString) {
    return new Date(isoOrUtcString).getTime();
}

function isOverlapping(trueStart, trueEnd, predStart, predEnd){
    if (predStart >= trueEnd || trueStart >= predEnd) return false;
    return true;
}

function getIOUScore(gtIntervals, predictedIntervals){
    let IouSum = 0;
    let IouCount = 0;
    for (let i = 0; i < gtIntervals.length; i++){
        let maxIou = 0;
        const trueStart = gtIntervals[i].start;
        const trueEnd = gtIntervals[i].end;
        
        // some intervals in gt_manifest are invalid,
        // producing reverse intervals. There are skipped here.

        if (trueEnd < trueStart) continue;

        for (let j = 0; j < predictedIntervals.length; j++){
            const predStartStr = predictedIntervals[j].start;
            const predEndStr = predictedIntervals[j].end;
            const predStart = toMs(predStartStr);
            const predEnd = toMs(predEndStr);
            if (!isOverlapping(trueStart, trueEnd, predStart, predEnd)) continue;

            const intersection = Math.min(trueEnd, predEnd) - Math.max(trueStart, predStart);
            const union = Math.max(trueEnd, predEnd) - Math.min(trueStart, predStart);
            const iou = (union > 0)?(intersection / union) : 0;

            maxIou = Math.max(maxIou, iou);
        }
        IouSum += maxIou;
        IouCount += 1;
    }
    
    const avgIou = (IouCount > 0)?(IouSum / IouCount) : 0;
    return avgIou;
}

export default getIOUScore;