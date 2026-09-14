const MAXLENGTH = 75;

function getCleanString(str){
    if (str === null || str === undefined) {
        return '';
    }
    const safeStr = String(str);
    const cleaned = safeStr.replace(/\s+/g, ' ').trim();

    if (cleaned.length <= MAXLENGTH) {
        return cleaned;
    }

    return cleaned.slice(0, MAXLENGTH) + '...';
}

function formatSegmentForLLM(segment) {
    const start = segment[0].start;
    const end = segment[segment.length - 1].end;

    let activeApp = null;
    let activeTitle = null;
    let activeUrl = null;

    const timeline = [];

    for (const ev of segment) {

        if (ev.type === "app_switch") {
            timeline.push(`Switched apps: ${ev.payload?.from?.app_name ?? "unknown"} to ${ev.payload?.to?.app_name ?? "unknown"}`);
        }

        const appChanged = ev.app && ev.app !== activeApp;
        const titleChanged = ev.window_title && ev.window_title !== activeTitle;
        const urlChanged = ev.url && ev.url !== activeUrl;

        if (appChanged || titleChanged || urlChanged) {

            if (appChanged) {
                activeTitle = null;
                activeUrl = null;
            }

            activeApp = ev.app || activeApp;
            activeTitle = ev.window_title || activeTitle;
            activeUrl = ev.url || activeUrl;


            let ctxStr = `[CONTEXT] App: ${activeApp}`;
            if (activeTitle) ctxStr += ` | Title: ${activeTitle}`;
            if (activeUrl) ctxStr += ` | URL: ${activeUrl}`;
            
            timeline.push(ctxStr);
        }

        if (ev.extracted_text?.text) {
            const cleanedExtractedText = getCleanString(ev.extracted_text.text);
            timeline.push(`[Text on Screen]: "${cleanedExtractedText}"`);
        }

        switch (ev.type) {
            case "app_switch":
                break;

            case "text_entry":
                if (ev.text) {
                    const fieldName = ev.field ? `field '${ev.field}'` : "input field";
                    timeline.push(`Typed "${ev.text}" into ${fieldName}`);
                }
                break;

            case "shortcut":
                timeline.push(`Ran shortcut: ${ev.combo}`);
                break;

            case "browser_click":
                const target = ev.payload?.field || ev.payload?.element_tag || "element";
                timeline.push(`Clicked browser ${target}`);
                break;

            case "browser_form_input":
                if (ev.payload?.value) {
                    const cleanInput = getCleanString(ev.payload.value);
                    timeline.push(`Set field '${ev.payload.field}' = "${cleanInput}"`);
                }
                break;

            case "clipboard_change":
                const clip = ev.payload?.preview || ev.payload?.text_content;
                if (clip) timeline.push(`Clipboard copy/paste: "${clip}"`);
                break;

            case "dialog_opened":
                timeline.push(`Opened Dialog: "${ev.window_title}"`);
                break;

            case "dialog_closed":
                timeline.push(`Closed Dialog: "${ev.window_title}"`);
                break;
        }
    }

    return {
        start,
        end,
        timeline,
    };
}

function compressSegment(segments){
    const compressedSegmentedEvents = [];
    for (const segment of segments){
        compressedSegmentedEvents.push(formatSegmentForLLM(segment));
    }
    return compressedSegmentedEvents;
}

export default compressSegment;