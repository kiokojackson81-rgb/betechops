"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = sleep;
exports.parseRetryAfter = parseRetryAfter;
exports.requestWithRetry = requestWithRetry;
async function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}
function parseRetryAfter(header) {
    if (!header)
        return null;
    const asInt = Number(header);
    if (!Number.isNaN(asInt) && asInt > 0)
        return asInt * 1000;
    const parsed = Date.parse(header);
    if (!Number.isNaN(parsed))
        return Math.max(0, parsed - Date.now());
    return null;
}
async function requestWithRetry(input, init, opts) {
    const maxRetries = opts?.maxRetries ?? 10;
    const baseDelay = 500;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let res;
        try {
            res = await fetch(input, init);
        }
        catch (err) {
            if (attempt === maxRetries)
                throw err;
            await sleep(Math.min(baseDelay * 2 ** attempt + Math.random() * 200, 30000));
            continue;
        }
        if (res.ok)
            return res;
        const status = res.status;
        const retryAfterHeader = res.headers.get("retry-after");
        if (status === 429 || (status >= 500 && status < 600)) {
            if (attempt === maxRetries) {
                let bodyText = "";
                try {
                    bodyText = await res.text();
                }
                catch { }
                throw new Error(`Request failed after ${maxRetries} retries: ${status} ${bodyText}`);
            }
            const raMs = parseRetryAfter(retryAfterHeader) ?? Math.min(baseDelay * 2 ** attempt, 30000);
            const jitter = Math.round(raMs * (0.2 + Math.random() * 0.6));
            await sleep(raMs + jitter);
            continue;
        }
        // For non-retriable client errors (4xx), surface response body in logs for diagnostics
        try {
            const bodyText = await res.text().catch(() => "");
            // eslint-disable-next-line no-console
            console.warn(`[fetchWithRetry] non-retriable response ${status} from ${input}: ${bodyText.slice(0, 1000)}`);
        }
        catch (e) {
            /* ignore */
        }
        return res;
    }
    throw new Error("requestWithRetry: unreachable");
}
