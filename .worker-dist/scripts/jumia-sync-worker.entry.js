"use strict";
// JS entry to run built worker from .worker-dist without ts-node
// Load .env when available but don't hard-require it (PM2 env may be sufficient)
try {
    require('dotenv/config');
}
catch (_) { }
// Prefer persistent HTTP keep-alive for vendor API calls to reduce DNS churn and latency
try {
    const { setGlobalDispatcher, Agent } = require('undici');
    setGlobalDispatcher(new Agent({
        keepAliveTimeout: 30000, // idle sockets kept for 30s
        keepAliveMaxTimeout: 60000, // hard cap 60s
        connections: 50, // enough for modest concurrency
        pipelining: 1, // safer with vendor APIs
    }));
}
catch (e) {
    // undici not available; continue without custom dispatcher
}
require('./jumia-sync-worker.js');
