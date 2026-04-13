// app.js

const $ = (id) => document.getElementById(id);

const els = {
    urls: $("urls"),
    start: $("start"),
    next: $("next"),
    stop: $("stop"),
    clear: $("clear"),
    count: $("count"),
    progress: $("progress"),
    download: $("download") // unused for now, but exists in HTML
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

function setTextareaUrls(urls) {
    els.urls.value = urls.join("\n");
    updateCount();
}

function setUI({ running, progressText }) {
    els.start.disabled = running;
    els.next.disabled = !running;
    els.stop.disabled = !running;
    // download stays disabled until we implement that feature
    els.download.disabled = true;

    if (progressText) els.progress.textContent = progressText;
}

els.urls.addEventListener("input", updateCount);

els.clear.addEventListener("click", () => {
    els.urls.value = "";
    visited = [];
    updateCount();
    els.progress.textContent = "Idle";
});

els.start.addEventListener("click", async () => {
    const urls = parseUrls(els.urls.value);
    if (!urls.length) {
        els.progress.textContent = "Paste at least 1 URL.";
        return;
    }

    visited = [];
    setTextareaUrls(urls); // normalize + remove blank lines visibly

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
    setTextareaUrls(currentUrls);

    els.progress.textContent = `Loaded. ${res.remaining} remaining.`;
});

els.stop.addEventListener("click", async () => {
    await browser.runtime.sendMessage({ type: "STOP" });
    setUI({ running: false, progressText: "Stopped." });
});

// Initial state
updateCount();
setUI({ running: false, progressText: "Idle" });