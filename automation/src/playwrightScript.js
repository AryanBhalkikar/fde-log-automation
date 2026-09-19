import { chromium } from "playwright";

const DEMO_DELAY_MS = Number(650);
const TYPING_DELAY_MS = Number(15);

function fillTemplate(template, type, date) {
    return template.replace("{type}", type).replace("{date}", date);
}

async function runAutoApproval(targetURL){
    const log = [];
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(targetURL);

    let iterations = 100;

    while (iterations > 0) {
        const pendingRows = page.locator("table tbody tr").filter({ has: page.locator(".status-badge.pending") });
        const rowCount = await pendingRows.count();
        if (rowCount === 0) break;
        const pendingRow = pendingRows.first();
        const requestId = await pendingRow.getAttribute("data-request-id");
        const cells = pendingRow.locator("td");
        const type = await cells.nth(1).innerText();
        const date = await cells.nth(2).innerText();

        const template = await page.locator("#note-template").inputValue();
        const noteText = fillTemplate(template, type, date);

        await pendingRow.locator(".la-note").pressSequentially(noteText, { delay: TYPING_DELAY_MS });
        await page.waitForTimeout(DEMO_DELAY_MS);
        await pendingRow.locator(".btn-la-ok").click();

        await page.locator(`tr[data-request-id="${requestId}"] .status-badge.completed`).waitFor({ timeout: 5000 });

        log.push({ requestId, type, date, noteText, status: "completed" });
        console.log(`Completed ${requestId}: ${type} / ${date}`);

        iterations--;
    }

    await browser.close();
    return { processedCount: log.length, log };
}

export default runAutoApproval;