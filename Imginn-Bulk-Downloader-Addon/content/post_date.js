function pad2(n) {
    return String(n).padStart(2, "0");
}

function formatStampFromDate(d) {
    // local time -> YYYYMMDD-HHMMSS
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}` +
        `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

function parseImginnPostTimeText(text) {
    // Expected format example: "Posted On: April 10th 2026, 03:45 pm"
    // Also handle: 10th/1st/2nd/3rd without relying on suffix.
    const postTimeRegex = /Posted\s+On:\s*([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4}),\s*(\d{1,2}):(\d{2})\s*([ap]m)\s*/i;
    const rawPostTime = text.match(postTimeRegex);
    if (!rawPostTime) return null;

    const monthName = rawPostTime[1].toLowerCase();
    const day = Number(rawPostTime[2]);
    const year = Number(rawPostTime[3]);
    let hour = Number(rawPostTime[4]);
    const minute = Number(rawPostTime[5]);
    const ampm = rawPostTime[6].toLowerCase();

    const monthMap = {
        january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
        july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
    };
    const month = monthMap[monthName];
    if (month == null) return null;

    // 12-hour -> 24-hour
    if (ampm === "pm" && hour !== 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;

    // Seconds are not provided by Imginn; use 00
    const postDateTime = new Date(year, month, day, hour, minute, 0);
    if (Number.isNaN(postDateTime.getTime())) return null;

    return { date: postDateTime, stamp: formatStampFromDate(postDateTime) };
}

function extractPostTimeTextPrimary() {
    const postTimeTextFromDivEl = document.querySelector("div.post-time");
    return postTimeTextFromDivEl?.textContent?.trim() || null;
}

function extractPostTimeTextFallback() {
    // Fallbacks if Imginn changes markup:
    // 1) <time datetime="...">
    const timeWithDatetimeEl = document.querySelector("time[datetime]");
    if (timeWithDatetimeEl?.getAttribute("datetime")) return timeWithDatetimeEl.getAttribute("datetime");

    // 2) any [datetime]
    const anyDatetimeEl = document.querySelector("[datetime]");
    if (anyDatetimeEl?.getAttribute("datetime")) return anyDatetimeEl.getAttribute("datetime");

    // 3) meta published time
    const metaPubTimeEl =
        document.querySelector('meta[property="article:published_time"]') ||
        document.querySelector('meta[name="article:published_time"]') ||
        document.querySelector('meta[property="og:published_time"]') ||
        document.querySelector('meta[name="og:published_time"]');
    const content = metaPubTimeEl?.getAttribute("content");
    if (content) return content;

    return null;
}

function parseFallbackToStamp(raw) {
    // If fallback returns an ISO-ish string, let Date parse it.
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return { date: d, stamp: formatStampFromDate(d) };
}

browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "GET_POST_DATE") return;

    const primaryRaw = extractPostTimeTextPrimary();
    if (primaryRaw) {
        const parsed = parseImginnPostTimeText(primaryRaw);
        if (parsed) {
            return Promise.resolve({
                ok: true,
                source: "div.post-time",
                raw: primaryRaw,
                stamp: parsed.stamp
            });
        }
        // If the div exists but format changed, fall through to fallback.
    }

    const fallbackRaw = extractPostTimeTextFallback();
    if (fallbackRaw) {
        const parsed = parseFallbackToStamp(fallbackRaw);
        if (parsed) {
            return Promise.resolve({
                ok: true,
                source: "fallback",
                raw: fallbackRaw,
                stamp: parsed.stamp
            });
        }
    }

    return Promise.resolve({
        ok: false,
        error: "Could not extract/parse post date from page."
    });
});

function tryNotifyReady() {
    const primaryRaw = extractPostTimeTextPrimary();
    if (primaryRaw) {
        const parsed = parseImginnPostTimeText(primaryRaw);
        if (parsed?.stamp) {
            browser.runtime.sendMessage({ type: "POST_DATE_READY", stamp: parsed.stamp }).catch(() => {});
            return true;
        }
    }

    const fallbackRaw = extractPostTimeTextFallback();
    if (fallbackRaw) {
        const parsed = parseFallbackToStamp(fallbackRaw);
        if (parsed?.stamp) {
            browser.runtime.sendMessage({ type: "POST_DATE_READY", stamp: parsed.stamp }).catch(() => {});
            return true;
        }
    }

    return false;
}

// Try immediately, and again after the DOM settles (Imginn sometimes injects late)
tryNotifyReady();
setTimeout(tryNotifyReady, 0);
setTimeout(tryNotifyReady, 250);
setTimeout(tryNotifyReady, 1000);