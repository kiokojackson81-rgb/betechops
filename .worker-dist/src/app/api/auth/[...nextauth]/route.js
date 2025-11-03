"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = exports.GET = void 0;
/* NextAuth route: keep this file minimal. authOptions lives in src/lib/nextAuth.ts to
   avoid exporting non-route symbols from a Next.js Route file. */
/* eslint-disable @typescript-eslint/no-explicit-any */
const next_1 = __importDefault(require("next-auth/next"));
const nextAuth_1 = require("@/lib/nextAuth");
const handler = (0, next_1.default)(nextAuth_1.authOptions);
exports.GET = handler;
exports.POST = handler;
