import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({ register });

const ordersProcessed = new client.Counter({
  name: 'jumia_orders_processed_total',
  help: 'Total number of orders processed by syncOrders',
  registers: [register],
});

const orderHandlerErrors = new client.Counter({
  name: 'jumia_order_handler_errors_total',
  help: 'Total number of per-order handler errors',
  registers: [register],
});

const fulfillments = new client.Counter({
  name: 'jumia_fulfillments_total',
  help: 'Total number of fulfill order attempts',
  registers: [register],
});

const fulfillmentFailures = new client.Counter({
  name: 'jumia_fulfillment_failures_total',
  help: 'Total number of failed fulfillments',
  registers: [register],
});

const fulfillmentLatency = new client.Histogram({
  name: 'jumia_fulfillment_latency_seconds',
  help: 'Fulfillment latency in seconds',
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

// Shop run metrics
const shopRuns = new client.Counter({
  name: 'jumia_shop_runs_total',
  help: 'Total number of shop sync runs attempted',
  registers: [register],
});

const shopRunFailures = new client.Counter({
  name: 'jumia_shop_run_failures_total',
  help: 'Total number of failed shop runs',
  registers: [register],
});

const shopsInProgress = new client.Gauge({
  name: 'jumia_shops_in_progress',
  help: 'Number of shop runs currently in progress',
  registers: [register],
});

export function incOrdersProcessed(n = 1) {
  ordersProcessed.inc(n);
}

export function incOrderHandlerErrors(n = 1) {
  orderHandlerErrors.inc(n);
}

export function incFulfillments(n = 1) {
  fulfillments.inc(n);
}

export function incFulfillmentFailures(n = 1) {
  fulfillmentFailures.inc(n);
}

export function observeFulfillmentLatency(ms: number) {
  fulfillmentLatency.observe(ms / 1000);
}

export function incShopRuns(n = 1) {
  shopRuns.inc(n);
}

export function incShopRunFailures(n = 1) {
  shopRunFailures.inc(n);
}

export function gaugeShopsInProgress(v: number) {
  shopsInProgress.set(v);
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}

export { register };
