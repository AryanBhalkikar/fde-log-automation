const MERGABLE_EVENTS = new Set([
    "keystroke",
    "mouse_click",
    "mouse_double_click",
    "mouse_scroll",
    "browser_click",
]);

const STANDALONE_EVENTS = new Set([
    "app_switch",
    "window_title_change",
    "window_state_change",
    "dialog_opened",
    "dialog_closed",
    "browser_navigation",
    "browser_tab_event",
    "clipboard_change",
    "browser_form_input",
]);

const MODIFIER_KEYS = new Set(["Shift", "Control", "Ctrl", "Alt", "Win", "Meta"]);

function reconstructText(keystrokeBuffer) {
    let text = "";
    let hasEnter = false;

    for (const ev of keystrokeBuffer) {
        const { key, character, is_printable, key_action } = ev.payload ?? {};

        if (key_action === "release") continue;
        if (MODIFIER_KEYS.has(key)) continue;

        if (key === "Backspace") {
            text = text.slice(0, -1);
            continue;
        }
        if (key === "Enter") {
            hasEnter = true;
            continue;
        }
        if (is_printable && character) {
            text += character;
        }
    }

    return { text, hasEnter };
}

function mergeBuffer(buffer){
    if (buffer.length === 1 && STANDALONE_EVENTS.has(buffer[0].type)) return buffer[0];
    
    const first = buffer[0];
    const last = buffer[buffer.length - 1];
    
    const base = {
        start: first.start,
        end: last.end,
        app: first.app,
        process_name: first.process_name,
        window_title: first.window_title,
        url: first.url,
        extracted_text: first.extracted_text,
        ms_since_last_event: first.ms_since_last_event,
        count: buffer.length,
        field: first.payload?.field ?? null,
    }

    if (first.type === "keystroke") {
        const { text, hasEnter } = reconstructText(buffer);
        return { type: "text_entry", ...base, text: text, submitted: hasEnter };
    }

    return { type: `${first.type}`, ...base };
}

function getBufferElementId(fEvent){
    return `${fEvent.type}|${fEvent.app}|${fEvent.window_title}|${fEvent.payload?.field ?? null}`;
}

function getFilteredEvent(event) {
    return {
        type: event.event_type,
        start: event.timestamp_iso,
        end: event.timestamp_iso,
        app: event.context?.active_app?.app_name,
        process_name: event.context?.active_app?.process_name,
        window_title: event.context?.active_app?.window_title,
        url: event.context?.active_browser_tab?.url,
        extracted_text: event.context?.extracted_text,
        ms_since_last_event: event.correlation?.ms_since_last_event ?? 0,
        payload: getFilteredPayload(event),
    };
}

function getFilteredPayload(event) {
    switch (event.event_type) {
        case "app_switch":
            return { from: event.payload?.previous_app, to: event.payload?.new_app };
        case "clipboard_change":
            return { 
                preview: event.payload?.content_preview ?? event.payload?.new_value, 
                text_content: event.payload?.text_content ?? null 
            };
        case "browser_navigation":
            return { 
                title: event.context?.active_browser_tab?.title ?? null
            };
        case "keystroke":
            return { 
                field: event.payload?.target_field?.name ??
                event.payload?.target_field?.automation_id ??
                event.payload?.target_field?.class_name ?? 
                "",
                key: event.payload?.key ?? null,
                character: event.payload?.character ?? null,
                is_printable: event.payload?.is_printable ?? false,
                key_action: event.payload?.key_action ?? null
            };
        case "browser_click":
            return {
                field: event.payload?.element?.attributes?.id ??
                event.payload?.element?.attributes?.class ??
                event.payload?.element?.attributes?.placeholder ??
                "",
                element_tag: event.payload?.element?.tag ?? null,
                click_text_content: event.payload?.element?.text_content ?? null
            };
        case "browser_form_input":
            return {
                field: event.payload?.element?.attributes?.name ??
                event.payload?.element?.attributes?.id ??
                event.payload?.element?.attributes?.placeholder ??
                "",
                value: event.payload?.value ?? null,
            };
        case "browser_tab_event":
            return {
                title: event.context?.active_browser_tab?.title ?? null,
                tab_action: event.payload?.action ?? null
            };
        default:
            return undefined;
    }
}

function isShortcut(payload) {
    const m = payload?.modifiers;
    return !!(m && (m.ctrl || m.alt || m.win));
}

function compress(events){
    const compressedEvents = [];
    let buffer = [];
    let prevBufferElementId = null;

    const clearBuffer = () => {
        if (buffer.length === 0) return;
        compressedEvents.push(mergeBuffer(buffer));
        buffer = [];
        prevBufferElementId = null;
    }

    for (const event of events){

        if (event.event_type === "app_switch" &&
            event.payload?.previous_app?.process_name === event.payload?.new_app?.process_name) {
            continue;
        }

        if (event.event_type === "keystroke" && 
            isShortcut(event.payload) && event.payload.key_action === "press"){
            clearBuffer();

            const m = event.payload.modifiers;
            let mStr = "";
            if (m.ctrl) mStr = "Ctrl";
            else if (m.alt) mStr = "Alt";
            else mStr = "Win";
            const modCombo = `${mStr} + ${event.payload.character ?? null}`;

            const eventEntry = {
                type: "shortcut",
                start: event.timestamp_iso,
                end: event.timestamp_iso,
                app: event.context?.active_app?.app_name,
                window_title: event.context?.active_app?.window_title,
                url: event.context?.active_browser_tab?.url,
                extracted_text: event.context?.extracted_text,
                ms_since_last_event: event.correlation?.ms_since_last_event ?? 0,
                combo: modCombo
            }

            compressedEvents.push(eventEntry);
            continue;
        }

        if (event.event_type === "keystroke" && event.payload?.key_action === "release") {
            continue;
        }

        const filteredEvent = getFilteredEvent(event);

        if (MERGABLE_EVENTS.has(event.event_type)){
            const currBufferElementId = getBufferElementId(filteredEvent);
            if (currBufferElementId === prevBufferElementId){
                buffer.push(filteredEvent);
            }
            else{
                clearBuffer();
                buffer.push(filteredEvent);
            }
            prevBufferElementId = currBufferElementId;
        }
        else if (STANDALONE_EVENTS.has(event.event_type)){
            clearBuffer();
            buffer.push(filteredEvent);
        }
    }
    clearBuffer();

    return compressedEvents;
}

export default compress;