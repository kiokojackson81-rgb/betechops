"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeSummary = exports.publishSummaryUpdate = void 0;
const events_1 = require("events");
const emitter = new events_1.EventEmitter();
// keep listener limit reasonable
emitter.setMaxListeners(100);
const publishSummaryUpdate = (payload) => {
    try {
        emitter.emit("summary", payload ?? { timestamp: new Date().toISOString() });
    }
    catch (err) {
        // best-effort
        console.warn("[receiptSseBroker] publish failed", err);
    }
};
exports.publishSummaryUpdate = publishSummaryUpdate;
const subscribeSummary = (fn) => {
    emitter.on("summary", fn);
    return () => emitter.off("summary", fn);
};
exports.subscribeSummary = subscribeSummary;
exports.default = {
    publishSummaryUpdate: exports.publishSummaryUpdate,
    subscribeSummary: exports.subscribeSummary,
};
