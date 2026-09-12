const WEIGHTS = {
    gapPerSecond: 1,
    gapCap: 6,
    appChanged: 3,
    windowTitleChanged: 2,
    routeChanged: 2,
};

const THRESHOLD = 4;

function getRoute(url) {
    if (!url) return null;
    const hashIndex = url.indexOf("#");
    if (hashIndex === -1) return null;
    return url.slice(hashIndex + 1);
}

function scoreGap(gapMs) {
    const seconds = gapMs / 1000;
    return Math.min(seconds * WEIGHTS.gapPerSecond, WEIGHTS.gapCap);
}

function getBoundaryScore(prev, curr){
    let score = 0;

    score += scoreGap(curr.ms_since_last_event ?? 0);

    if (curr.app !== prev.app) {
        score += WEIGHTS.appChanged;
    }

    if (curr.window_title !== prev.window_title) {
        score += WEIGHTS.windowTitleChanged;
    }

    const prevRoute = getRoute(prev.url);
    const currRoute = getRoute(curr.url);
    if (prevRoute && currRoute && prevRoute !== currRoute) {
        score += WEIGHTS.routeChanged;
    }

    return score;
}

function getSegments(compressedEvents){
    if (compressedEvents.length === 0) return;

    const segments = [];
    let buffer = [compressedEvents[0]];
    
    for (let i = 1; i < compressedEvents.length; i++){
        let prev = compressedEvents[i-1];
        let curr = compressedEvents[i];

        const boundaryScore = getBoundaryScore(prev, curr);

        if (boundaryScore >= THRESHOLD){
            segments.push(buffer);
            buffer = [];
        }
        
        buffer.push(curr);
    }
    segments.push(buffer);

    return segments;
}

export default getSegments;