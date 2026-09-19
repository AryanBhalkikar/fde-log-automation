const SEED_REQUESTS = [
    { type: "半日有給申請", date: "2026-07-23" },
    { type: "特別休暇（慶弔）", date: "2026-07-24" },
    { type: "特別休暇（慶弔）", date: "2026-07-11" },
    { type: "代休申請", date: "2026-07-13" },
    { type: "半日有給申請", date: "2026-07-11" },
    { type: "年次有給休暇", date: "2026-07-13" },
    { type: "年次有給休暇", date: "2026-07-17" },
    { type: "半日有給申請", date: "2026-07-18" },
    { type: "年次有給休暇", date: "2026-07-21" },
    { type: "半日有給申請", date: "2026-07-14" },
    { type: "フレックス変更申請", date: "2026-07-22" },
    { type: "特別休暇（慶弔）", date: "2026-07-14" },
    { type: "フレックス変更申請", date: "2026-07-21" },
    { type: "特別休暇（慶弔）", date: "2026-07-12" },
    { type: "フレックス変更申請", date: "2026-07-12" },
    { type: "代休申請", date: "2026-07-16" },
    { type: "特別休暇（慶弔）", date: "2026-07-07" },
];

const requests = SEED_REQUESTS.map((r, i) => ({
    id: `${String(i + 1).padStart(3, "0")}`,
    type: r.type,
    date: r.date,
    status: "pending",
}));

const tbody = document.getElementById("request-rows");
const templateInput = document.getElementById("note-template");
const runBatchBtn = document.getElementById("run-batch-approval");

function renderRows() {
    tbody.innerHTML = "";

    for (const req of requests) {
        const row = document.createElement("tr");
        row.dataset.requestId = req.id;

        row.innerHTML = `
            <td>${req.id}</td>
            <td>${req.type}</td>
            <td>${req.date}</td>
            <td><span class="status-badge ${req.status}">${req.status === "pending" ? "Pending" : "Completed"}</span></td>
            <td><textarea class="la-note" rows="2" ${req.status === "completed" ? "disabled" : ""}></textarea></td>
            <td><button class="btn-la-ok" ${req.status === "completed" ? "disabled" : ""}>OK</button></td>
        `;

        tbody.appendChild(row);
    }

    tbody.querySelectorAll(".btn-la-ok").forEach(btn => {
        btn.addEventListener("click", handleApprove);
    });

    updateBatchButtonState();
}

function handleApprove(event) {
    const row = event.target.closest("tr");
    const requestId = row.dataset.requestId;
    const request = requests.find(r => r.id === requestId);
    if (!request || request.status === "completed") return;

    request.status = "completed";
    renderRows();
}

function updateBatchButtonState() {
    const hasPending = requests.some(r => r.status === "pending");
    runBatchBtn.disabled = !hasPending;
}

runBatchBtn.addEventListener("click", async () => {
    runBatchBtn.disabled = true;
    const url = "http://localhost:3000/api/autoApprove";
    try{
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({targetURL: "http://localhost:3000/"}),
        });
        if (!response.ok) throw new Error(`Server error: ${response.status}`);
        const result = await response.json();
        console.log("Playwright script successfully initialized:", result.message);
    }
    catch(err){
        console.log(`script.js throws error: ${err.message}`);
    }
    finally{
        runBatchBtn.disabled = true;
        updateBatchButtonState();
    }
});

renderRows();