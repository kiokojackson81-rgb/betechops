"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAllJobs = runAllJobs;
const syncJobs_1 = require("./jobs/syncJobs");
async function runAllJobs() {
    const out = {};
    out.syncOrders = await (0, syncJobs_1.syncOrdersJob)();
    out.syncPayouts = await (0, syncJobs_1.syncPayoutsJob)();
    out.returnsSla = await (0, syncJobs_1.returnsSlaJob)();
    out.commissionCalc = await (0, syncJobs_1.commissionCalcJob)();
    out.priceLearner = await (0, syncJobs_1.priceLearnerJob)();
    return out;
}
// Example: callers can import runAllJobs and invoke on a schedule.
