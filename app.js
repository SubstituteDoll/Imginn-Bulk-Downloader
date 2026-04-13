// app.js

const $ = (id) => document.getElementById(id);

const els = {
    urls: $("urls"),
    start: $("start"),
    next: $("next"),
    stop: $("stop"),
    clear: $("clear"),
    count: $("count"),
    progress: $("progress")
};

function parseUrls(text) {
    return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function updateCount() {
    els.count.textContent = String(parseUrls(els.urls.value).length);
}

function setUI({ running, progressText }) {
    els.start.disabled = running;
    els.next.disabled = !running;
    els.stop.disabled = !running;
    if (progressText) els.progress.textContent = progressText;
}

els.urls.addEventListener("input", updateCount);

els.clear.addEventListener("click", () => {
    els.urls.value = "";
    updateCount();
    els.progress.textContent = "Idle";
});

els.start.addEventListener("click", async () => {
    const urls = parseUrls(els.urls.value);
    if (!urls.length) {
        els.progress.textContent = "Paste at least 1 URL.";
        return;
    }

    const res = await browser.runtime.sendMessage({ type: "START", urls });
    if (!res?.ok) {
        els.progress.textContent = "Failed to start.";
        return;
    }

    setUI({ running: true, progressText: `Ready (${res.remaining} in queue). Click Next URL.` });
});

els.next.addEventListener("click", async () => {
    const res = await browser.runtime.sendMessage({ type: "LOAD_NEXT" });

    if (!res?.ok) {
        els.progress.textContent = res?.error || "Failed to load next URL.";
        return;
    }

    if (res.done) {
        setUI({ running: false, progressText: "Done. Queue finished." });
    } else {
        els.progress.textContent = `Loaded. ${res.remaining} remaining.`;
    }
});

els.stop.addEventListener("click", async () => {
    await browser.runtime.sendMessage({ type: "STOP" });
    setUI({ running: false, progressText: "Stopped." });
});

// Initial state
updateCount();
setUI({ running: false, progressText: "Idle" });