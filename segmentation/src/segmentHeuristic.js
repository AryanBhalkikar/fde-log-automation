const WEIGHTS = {
    gapPerSecond: 1,
    gapCap: 8,
    appChangedSlow: 5,
    appChangedFast: 1,
    routeChanged: 4,
    windowTitleChanged: 2,
    formSubmitted: 2,
};

const THRESHOLD = 6;

function getRouteOrPath(url) {
    if (!url) return null;
    try {
        const hashIndex = url.indexOf("#");
        if (hashIndex !== -1) return url.slice(hashIndex + 1);
        const parsed = new URL(url);
        return parsed.pathname;
    } catch {
        return url;
    }
}

function scoreGap(gapMs) {
    const seconds = gapMs / 1000;
    return Math.min(seconds * WEIGHTS.gapPerSecond, WEIGHTS.gapCap);
}

function getBoundaryScore(prev, curr) {
    let score = 0;

    const prevEndMs = new Date(prev.end).getTime();
    const currStartMs = new Date(curr.start).getTime();
    const actualGapMs = Math.max(0, currStartMs - prevEndMs);

    score += scoreGap(actualGapMs);

    const prevRoute = getRouteOrPath(prev.url);
    const currRoute = getRouteOrPath(curr.url);
    const routeHasChanged = prevRoute && currRoute && prevRoute !== currRoute;
    const appHasChanged = curr.app && prev.app && curr.app !== prev.app;
    const windowHasChanged = curr.window_title && prev.window_title && curr.window_title !== prev.window_title;

    if (routeHasChanged) {
        score += WEIGHTS.routeChanged;
    } 
    else if (windowHasChanged) {
        score += WEIGHTS.windowTitleChanged;
    }
    else if (appHasChanged) {
        const isFastSwitch = actualGapMs < 5000;
        const isClipboardChain = prev.type === "clipboard_change";
        if (isFastSwitch || isClipboardChain) {
            score += WEIGHTS.appChangedFast;
        } else {
            score += WEIGHTS.appChangedSlow;
        }
    } 

    if (prev.submitted || prev.type === "dialog_closed") {
        score += WEIGHTS.formSubmitted;
    }

    return score;
}

function getSegments(compressedEvents) {
    if (!compressedEvents || compressedEvents.length === 0) return [];

    const segments = [];
    let buffer = [compressedEvents[0]];

    for (let i = 1; i < compressedEvents.length; i++) {
        const prev = compressedEvents[i - 1];
        const curr = compressedEvents[i];

        const boundaryScore = getBoundaryScore(prev, curr);

        if (boundaryScore >= THRESHOLD) {
            segments.push(buffer);
            buffer = [];
        }

        buffer.push(curr);
    }
    segments.push(buffer);

    return segments;
}

export default getSegments;