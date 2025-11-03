"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = void 0;
exports.incOrdersProcessed = incOrdersProcessed;
exports.incOrderHandlerErrors = incOrderHandlerErrors;
exports.incFulfillments = incFulfillments;
exports.incFulfillmentFailures = incFulfillmentFailures;
exports.observeFulfillmentLatency = observeFulfillmentLatency;
exports.incShopRuns = incShopRuns;
exports.incShopRunFailures = incShopRunFailures;
exports.gaugeShopsInProgress = gaugeShopsInProgress;
exports.getMetrics = getMetrics;
const prom_client_1 = __importDefault(require("prom-client"));
const register = new prom_client_1.default.Registry();
exports.register = register;
prom_client_1.default.collectDefaultMetrics({ register });
const ordersProcessed = new prom_client_1.default.Counter({
    name: 'jumia_orders_processed_total',
    help: 'Total number of orders processed by syncOrders',
    registers: [register],
});
const orderHandlerErrors = new prom_client_1.default.Counter({
    name: 'jumia_order_handler_errors_total',
    help: 'Total number of per-order handler errors',
    registers: [register],
});
const fulfillments = new prom_client_1.default.Counter({
    name: 'jumia_fulfillments_total',
    help: 'Total number of fulfill order attempts',
    registers: [register],
});
const fulfillmentFailures = new prom_client_1.default.Counter({
    name: 'jumia_fulfillment_failures_total',
    help: 'Total number of failed fulfillments',
    registers: [register],
});
const fulfillmentLatency = new prom_client_1.default.Histogram({
    name: 'jumia_fulfillment_latency_seconds',
    help: 'Fulfillment latency in seconds',
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [register],
});
// Shop run metrics
const shopRuns = new prom_client_1.default.Counter({
    name: 'jumia_shop_runs_total',
    help: 'Total number of shop sync runs attempted',
    registers: [register],
});
const shopRunFailures = new prom_client_1.default.Counter({
    name: 'jumia_shop_run_failures_total',
    help: 'Total number of failed shop runs',
    registers: [register],
});
const shopsInProgress = new prom_client_1.default.Gauge({
    name: 'jumia_shops_in_progress',
    help: 'Number of shop runs currently in progress',
    registers: [register],
});
function incOrdersProcessed(n = 1) {
    ordersProcessed.inc(n);
}
function incOrderHandlerErrors(n = 1) {
    orderHandlerErrors.inc(n);
}
function incFulfillments(n = 1) {
    fulfillments.inc(n);
}
function incFulfillmentFailures(n = 1) {
    fulfillmentFailures.inc(n);
}
function observeFulfillmentLatency(ms) {
    fulfillmentLatency.observe(ms / 1000);
}
function incShopRuns(n = 1) {
    shopRuns.inc(n);
}
function incShopRunFailures(n = 1) {
    shopRunFailures.inc(n);
}
function gaugeShopsInProgress(v) {
    shopsInProgress.set(v);
}
async function getMetrics() {
    return register.metrics();
}
