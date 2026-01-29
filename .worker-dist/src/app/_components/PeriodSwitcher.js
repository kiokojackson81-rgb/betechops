"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PeriodSwitcher;
const jsx_runtime_1 = require("react/jsx-runtime");
const Button_1 = __importDefault(require("@/app/_components/Button"));
const tradingPeriod_1 = require("@/lib/tradingPeriod");
function PeriodSwitcher({ currentPeriod, selectedPeriod, onSelectPeriod, }) {
    const previousPeriod = (0, tradingPeriod_1.getPreviousTradingPeriod)(selectedPeriod);
    const viewingCurrent = selectedPeriod.key === currentPeriod.key;
    return ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: () => onSelectPeriod(previousPeriod), className: "px-4 text-sm", children: "View previous period" }), !viewingCurrent && ((0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: () => onSelectPeriod(currentPeriod), className: "px-4 text-sm", children: "Return to current period" }))] }));
}
