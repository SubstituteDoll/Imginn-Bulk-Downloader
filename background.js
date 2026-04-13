// background.js (Firefox MV3 service worker)

const STATE_KEY = "runState";

let state = {
    running: false,
    tabId: null,
    queue: [],
    visited: []
};

// State loading safeguard
let stateLoaded = false;
async function ensureStateLoaded() {
    if (stateLoaded) return;
    await debugSessionStorage();
    await loadState();
    stateLoaded = true;
}

async function loadState() {
    const obj = await browser.storage.session.get(STATE_KEY);
    if (obj?.[STATE_KEY]) state = obj[STATE_KEY];
}

async function saveState() {
    await browser.storage.session.set({ [STATE_KEY]: state });
}

async function debugSessionStorage() {
    try {
        await browser.storage.session.set({ __test: Date.now() });
        const got = await browser.storage.session.get("__test");
        console.log("storage.session test:", got.__test);
    } catch (e) {
        console.error("storage.session not available:", e);
    }
}

// async function getActiveTabId() {
//     const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
//     if (!tab?.id) throw new Error("No active tab.");
//     return tab.id;
// }

async function getOrCreateRunnableTabId() {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || "";

    // about:newtab / about:home / about:blank etc. are not safe to drive in Firefox
    if (!tab?.id || url.startsWith("about:")) {
        const created = await browser.tabs.create({ url: "about:blank", active: true });
        return created.id;
    }

    return tab.id;
}

function normalizeUrl(s) {
    const t = (s || "").trim();
    if (!t) return null;
    if (/^https?:\/\//i.test(t)) return t;
    return `https://${t}`;
}

browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "START") {
        return (async () => {
            await ensureStateLoaded();

            const urls = (msg.urls || []).map(normalizeUrl).filter(Boolean);

            state.queue = urls;
            state.visited = [];
            state.tabId = await getOrCreateRunnableTabId();
            state.running = true;

            await saveState();
            return { ok: true, remaining: state.queue.length };
        })();
    }

    if (msg?.type === "LOAD_NEXT") {
        return (async () => {
            await ensureStateLoaded();

            if (!state.running) throw new Error("Not running. Click Start first.");

            const next = state.queue.shift();
            if (!next) {
                state.running = false;
                await saveState();
                return { ok: true, done: true, remaining: 0, consumedUrl: null };
            }

            state.visited.push(next);
            await saveState();

            await browser.tabs.update(state.tabId, { url: next });

            return { ok: true, done: false, remaining: state.queue.length, consumedUrl: next };
        })();
    }

    if (msg?.type === "STOP") {
        return (async () => {
            await ensureStateLoaded();

            state.running = false;
            state.queue = [];
            state.visited = [];
            state.tabId = null;
            await saveState();
            return { ok: true };
        })();
    }

    if (msg?.type === "STATUS") {
        return (async () => {
            await ensureStateLoaded();

            return {
                ok: true,
                running: state.running,
                remaining: state.queue.length,
                visitedCount: state.visited.length
            };
        })();
    }

    if (msg?.type === "GET_VISITED") {
        return (async () => {
            await ensureStateLoaded();

            return { ok: true, visited: state.visited.slice() };
        })();
    }
});