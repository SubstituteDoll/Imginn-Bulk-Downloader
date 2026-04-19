// app.js

const $ = (id) => document.getElementById(id);

const els = {
    urls: $("urls"),
    start: $("start"),
    next: $("next"),
    reset: $("reset"),
    count: $("count"),
    progress: $("progress"),
    visitedCount: $("visitedCount"),
    visitedField: $("visited"),
    filePattern: $("filePattern"),
    download: $("download") // Not implemented yet
};

let visited = [];

function normalizeUrl(s) {
    const t = (s || "").trim();
    if (!t) return null;
    if (/^https?:\/\//i.test(t)) return t;
    return `https://${t}`;
}

function parseUrls(text) {
    return text.split(/\r?\n/).map(normalizeUrl).filter(Boolean);
}

function updateCount() {
    els.count.textContent = String(parseUrls(els.urls.value).length);
}

function updateVisitedCount() {
    els.visitedCount.textContent = String(visited.length);
}

function setTextareaUrls(urls) {
    els.urls.value = urls.join("\n");
    updateCount();
}

function setUI({ running, progressText }) {
    els.start.disabled = running;
    els.next.disabled = !running;

    // download stays disabled until we implement that feature
    els.download.disabled = true;

    // Lock textarea while running
    els.urls.readOnly = running;

    if (progressText) els.progress.textContent = progressText;
}

function renderVisited() {
    // Show latest visited first
    els.visitedField.value = visited.slice().reverse().join("\n");
}

// Deprecated in favor of acting on background's broadcast,
// but left alive for debugging purposes
async function refreshFilePattern() {
    const res = await browser.runtime.sendMessage({ type: "GET_POST_DATE" }).catch(() => null);

    if (!res?.ok || !res.stamp) {
        els.filePattern.textContent = "—";
        return;
    }

    els.filePattern.textContent = `${res.stamp}_N`;
}

els.urls.addEventListener("input", updateCount);

els.start.addEventListener("click", async () => {
    const urls = parseUrls(els.urls.value);
    if (!urls.length) {
        els.progress.textContent = "Paste at least 1 URL.";
        return;
    }

    visited = [];
    updateVisitedCount();
    renderVisited();
    setTextareaUrls(urls); // normalize + remove blank lines visibly

    const res = await browser.runtime.sendMessage({ type: "START", urls });
    if (!res?.ok) {
        els.progress.textContent = "Failed to start.";
        return;
    }

    // clear filename immediately; background will broadcast when page loads
    els.filePattern.textContent = "—";

    setUI({ running: true, progressText: "Ready" });
});

els.next.addEventListener("click", async () => {
    const res = await browser.runtime.sendMessage({ type: "LOAD_NEXT" });

    if (!res?.ok) {
        els.progress.textContent = res?.error || "Failed to load next URL.";
        return;
    }

    if (res.done) {
        setUI({ running: false, progressText: "Done. Queue finished." });
        // clear filename when done
        els.filePattern.textContent = "—";
        return;
    }

    const currentUrls = parseUrls(els.urls.value);
    const consumed = normalizeUrl(res.consumedUrl);

    if (currentUrls.length && consumed && currentUrls[0] === consumed) {
        currentUrls.shift();
    } else {
        const idx = consumed ? currentUrls.indexOf(consumed) : -1;
        if (idx >= 0) currentUrls.splice(idx, 1);
        else if (currentUrls.length) currentUrls.shift();
    }

    if (consumed) visited.push(consumed);
    updateVisitedCount();
    renderVisited();
    setTextareaUrls(currentUrls);

    // clear filename while the next page is loading; background will broadcast stamp
    els.filePattern.textContent = "—";

    els.progress.textContent = "Loaded";
});

els.reset.addEventListener("click", async () => {
    // Stop background run (safe even if not running)
    await browser.runtime.sendMessage({ type: "STOP" }).catch(() => { });

    // Clear popup UI
    els.urls.value = "";
    visited = [];
    updateVisitedCount();
    renderVisited();
    updateCount();

    // clear filename on reset
    els.filePattern.textContent = "—";

    setUI({ running: false, progressText: "Idle" });
});

browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "RUN_TAB_POST_DATE") {
        els.filePattern.textContent = msg.stamp ? `${msg.stamp}_N` : "—";
    }
});

// Initial state
updateCount();
updateVisitedCount();
renderVisited();
setUI({ running: false, progressText: "Idle" });

// don't poll GET_POST_DATE on popup open; background broadcast is the source of truth
// refreshFilePattern();

// Restore state (Used on focus loss, pull state from background.js)
async function restoreFromBackground() {
    const res = await browser.runtime.sendMessage({ type: "GET_STATE" }).catch(() => null);
    if (!res?.ok) return;

    // Rebuild the textarea from remaining queue (consumed URLs are intentionally not shown)
    setTextareaUrls(res.queue || []);

    // Restore local visited
    visited = res.visited || [];
    updateVisitedCount();
    renderVisited();

    // clear filename on restore; background will broadcast when run tab loads an imginn page
    els.filePattern.textContent = "—";

    if (res.running) {
        setUI({ running: true, progressText: "Ready" });
    } else {
        setUI({ running: false, progressText: "Idle" });
    }
}

restoreFromBackground();