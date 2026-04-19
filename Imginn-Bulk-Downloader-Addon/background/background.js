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
    if (!tab?.id) throw new Error("No active tab.");
    return tab.id;
}

function normalizeUrl(s) {
    const t = (s || "").trim();
    if (!t) return null;
    if (/^https?:\/\//i.test(t)) return t;
    return `https://${t}`;
}

function broadcastToPopup(message) {
    browser.runtime.sendMessage(message).catch(() => { });
}

let lastRunTabStamp = null;

async function publishRunTabPostDate() {
    await ensureStateLoaded();
    if (!state?.tabId) return;

    try {
        const res = await browser.tabs.sendMessage(state.tabId, { type: "GET_POST_DATE" });
        if (res?.ok && res.stamp) {
            broadcastToPopup({ type: "RUN_TAB_POST_DATE", stamp: res.stamp });
        } else {
            broadcastToPopup({ type: "RUN_TAB_POST_DATE", stamp: null });
        }
    } catch (e) {
        // content script not ready / not injected / wrong page
        broadcastToPopup({ type: "RUN_TAB_POST_DATE", stamp: null });
    }
}

// listen for run tab load completion and then publish post date
browser.tabs.onUpdated.addListener((tabId, info) => {
    if (tabId !== state?.tabId) return;
    if (info.status !== "complete") return;

    // Run tab finished loading; now content script should exist (on imginn pages)
    publishRunTabPostDate();
});

browser.runtime.onMessage.addListener((msg, sender) => {
    // Content script can proactively tell us the stamp when it's actually ready
    if (msg?.type === "POST_DATE_READY") {
        // Only accept if it came from the run tab (prevents other tabs from spoofing UI)
        const senderTabId = sender?.tab?.id;
        if (senderTabId && senderTabId === state?.tabId && msg.stamp) {
            lastRunTabStamp = msg.stamp;
            broadcastToPopup({ type: "RUN_TAB_POST_DATE", stamp: msg.stamp });
        }
        return;
    }

    if (msg?.type === "START") {
        return (async () => {
            await ensureStateLoaded();

            const urls = (msg.urls || []).map(normalizeUrl).filter(Boolean);

            state.queue = urls;
            state.visited = [];
            state.tabId = await getOrCreateRunnableTabId();
            state.running = true;

            lastRunTabStamp = null;
            await saveState();

            // clear filename until a real page loads
            broadcastToPopup({ type: "RUN_TAB_POST_DATE", stamp: null });

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
                // Clear file name when done
                broadcastToPopup({ type: "RUN_TAB_POST_DATE", stamp: null });
                lastRunTabStamp = null;
                return { ok: true, done: true, remaining: 0, consumedUrl: null };
            }

            state.visited.push(next);
            await saveState();

            // clear filename immediately; it will be updated on tabs.onUpdated complete
            broadcastToPopup({ type: "RUN_TAB_POST_DATE", stamp: null });

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

            lastRunTabStamp = null;
            await saveState();

            // clear filename on reset
            broadcastToPopup({ type: "RUN_TAB_POST_DATE", stamp: null });

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

    if (msg?.type === "GET_POST_DATE") {
        return (async () => {
            await ensureStateLoaded();

            const t = await browser.tabs.get(state.tabId);
            console.log("GET_POST_DATE querying run tab:", state.tabId, t?.url);

            if (!state?.tabId) return { ok: false, error: "No run tab yet." };
            try {
                return await browser.tabs.sendMessage(state.tabId, { type: "GET_POST_DATE" });
            } catch (e) {
                return { ok: false, error: String(e) };
            }
        })();
    }


    if (msg?.type === "GET_STATE") {
        return (async () => {
            await ensureStateLoaded();
            return {
                ok: true,
                running: state.running,
                queue: state.queue.slice(),
                visited: state.visited.slice(),
                lastRunTabStamp
            };
        })();
    }
});