"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantEditPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const prisma_1 = require("@/lib/prisma");
const AttendantEditorClient_1 = __importDefault(require("./AttendantEditorClient"));
const getLandingPage_1 = require("@/lib/getLandingPage");
async function AttendantEditPage({ params }) {
    // Defensively handle `params` which may be a Promise in some runtimes.
    let resolvedParams = params;
    if (resolvedParams && typeof resolvedParams.then === "function") {
        try {
            resolvedParams = await resolvedParams;
        }
        catch (e) {
            // eslint-disable-next-line no-console
            console.error("[admin/attendants] failed to resolve params", { err: e });
            resolvedParams = null;
        }
    }
    const { id } = (resolvedParams ?? {});
    const attendant = await prisma_1.prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, attendantCategory: true, isActive: true },
    });
    if (!attendant)
        return (0, jsx_runtime_1.jsx)("div", { className: "p-8", children: "Attendant not found" });
    const prepared = {
        ...attendant,
        categoryLabel: (0, getLandingPage_1.getCategoryLabel)(attendant.attendantCategory),
    };
    return (0, jsx_runtime_1.jsx)(AttendantEditorClient_1.default, { attendant: prepared });
}
