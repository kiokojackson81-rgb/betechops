"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentTradingPeriod = getCurrentTradingPeriod;
const prisma_1 = require("@/lib/prisma");
const formatLabel = (date, opts) => date.toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    ...(opts ?? {}),
});
async function getCurrentTradingPeriod() {
    const today = new Date();
    let period = await prisma_1.prisma.commissionPeriod.findFirst({
        where: {
            startDate: { lte: today },
            endDate: { gte: today },
        },
        orderBy: { startDate: "desc" },
    });
    if (!period) {
        period = await prisma_1.prisma.commissionPeriod.findFirst({
            orderBy: { endDate: "desc" },
        });
    }
    if (!period) {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        const label = `${formatLabel(start)} – ${formatLabel(end, {
            year: "numeric",
        })}`;
        return {
            key: `${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}`,
            label,
            startDate: start,
            endDate: end,
        };
    }
    const start = period.startDate;
    const end = period.endDate;
    const label = `${formatLabel(start)} – ${formatLabel(end, { year: "numeric" })}`;
    return {
        key: `${start.toISOString().slice(0, 10)}_${end.toISOString().slice(0, 10)}`,
        label,
        startDate: start,
        endDate: end,
    };
}
