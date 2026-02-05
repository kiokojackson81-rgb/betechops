"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DailyReportRedesign;
const jsx_runtime_1 = require("react/jsx-runtime");
const DailyReportRedesignDraft_1 = __importDefault(require("./DailyReportRedesignDraft"));
function DailyReportRedesign() {
    // Swap the wrapper to render the redesign draft so the new UX is shown.
    // The draft preserves the original payload/autosave behavior; after
    // QA we can remove the draft and clean up types.
    return (0, jsx_runtime_1.jsx)(DailyReportRedesignDraft_1.default, {});
}
