"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AttendantsPage;
const prisma_1 = require("@/lib/prisma");
const AttendantsManager_1 = __importDefault(require("./AttendantsManager"));
const categories_1 = require("@/lib/attendants/categories");
async function AttendantsPage() {
    const attendants = await prisma_1.prisma.user.findMany({
        where: { role: { in: ["ATTENDANT", "SUPERVISOR"] } },
        orderBy: [{ attendantCategory: "asc" }, { name: "asc" }],
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            attendantCategory: true,
            isActive: true,
            createdAt: true,
            categoryAssignments: { select: { category: true } },
        },
    });
    const prepared = attendants.map(({ categoryAssignments, createdAt, ...rest }) => ({
        ...rest,
        createdAt: createdAt.toISOString(),
        categories: categoryAssignments.map((c) => c.category),
    }));
    return (<div className="mx-auto max-w-6xl space-y-8 p-8 text-slate-100">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Attendants &amp; Categories</h1>
        <p className="text-slate-300">
          Assign each attendant to all categories that match their day-to-day work. Categories drive the attendant dashboard widgets and the admin reports
          below.
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-slate-400">
          {categories_1.attendantCategories.map((cat) => (<span key={cat.id} className="rounded-full border border-white/10 px-3 py-1">
              <span className="font-medium text-white">{cat.label}</span>
              <span className="mx-2 text-slate-500">-</span>
              {cat.description}
            </span>))}
        </div>
      </header>

      <AttendantsManager_1.default initial={prepared}/>
    </div>);
}
