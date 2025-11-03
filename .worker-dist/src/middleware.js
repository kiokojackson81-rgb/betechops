"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.middleware = middleware;
// Disabled duplicate middleware. Root-level middleware.ts is the single source of truth.
const server_1 = require("next/server");
function middleware() {
    return server_1.NextResponse.next();
}
// Empty matcher to ensure this middleware never runs. Avoid TS assertions in config to satisfy Next.js parser.
exports.config = { matcher: [] };
