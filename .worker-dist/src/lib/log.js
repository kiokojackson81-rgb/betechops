"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const level = process.env.LOG_LEVEL || 'info';
// Only enable pretty transport if explicitly requested AND the package is installed.
// This avoids runtime errors in Next/Turbopack dev when 'pino-pretty' isn't present.
const enablePretty = ['1', 'true', 'yes'].includes(String(process.env.PINO_PRETTY || '').toLowerCase());
const transport = enablePretty ? { target: 'pino-pretty' } : undefined;
exports.logger = (0, pino_1.default)({
    level,
    transport,
});
exports.default = exports.logger;
