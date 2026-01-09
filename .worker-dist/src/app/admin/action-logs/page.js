"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.default = ActionLogsPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const prisma_1 = require("@/lib/prisma");
const RestoreButtonClient_1 = __importDefault(require("./RestoreButtonClient"));
const UndoLastWipeClient_1 = __importDefault(require("./UndoLastWipeClient"));
exports.dynamic = 'force-dynamic';
async function ActionLogsPage() {
    // Fetch recent action logs related to marketing entries
    const logs = await prisma_1.prisma.actionLog.findMany({
        where: { OR: [{ entity: 'MarketingDailyEntry' }, { action: 'WIPE_RECEIPTS' }] },
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    return ((0, jsx_runtime_1.jsxs)("div", { className: "mx-auto max-w-6xl p-6 text-slate-100", children: [(0, jsx_runtime_1.jsx)("h1", { className: "text-2xl font-semibold mb-4", children: "Action logs" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Recent actions for MarketingDailyEntry and wipes. Useful for audits and reversals." }), (0, jsx_runtime_1.jsx)(UndoLastWipeClient_1.default, { lastWipeId: logs.find((x) => x.action === 'WIPE_RECEIPTS')?.id })] }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 p-2", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-slate-950/80 text-left text-xs uppercase tracking-wide text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "When" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Actor" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Action" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Entity" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Entity ID" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Before" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "After" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { children: [logs.map((l) => ((0, jsx_runtime_1.jsxs)("tr", { className: "border-t border-slate-800 odd:bg-slate-950/40", children: [(0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: new Date(l.createdAt).toISOString() }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: (l.actor && (l.actor.email || l.actor.name)) || 'system' }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: l.action }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: l.entity }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: l.entityId }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", title: JSON.stringify(l.before || {}).slice(0, 1000), children: (0, jsx_runtime_1.jsx)("pre", { className: "whitespace-pre-wrap max-h-40 overflow-auto text-xs", children: JSON.stringify(l.before || {}, null, 2) }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", title: JSON.stringify(l.after || {}).slice(0, 1000), children: (0, jsx_runtime_1.jsx)("pre", { className: "whitespace-pre-wrap max-h-40 overflow-auto text-xs", children: JSON.stringify(l.after || {}, null, 2) }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2", children: l.action === 'WIPE_RECEIPTS' ? (0, jsx_runtime_1.jsx)(RestoreButtonClient_1.default, { actionLogId: l.id }) : null })] }, l.id))), logs.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-6 text-center text-slate-400", colSpan: 7, children: "No action logs found." }) }))] })] }) })] }));
}
