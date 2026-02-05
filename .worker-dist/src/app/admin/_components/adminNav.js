"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NAV = void 0;
// src/app/admin/_components/adminNav.ts
const lucide_react_1 = require("lucide-react");
exports.NAV = [
    { href: "/admin", label: "Overview", icon: lucide_react_1.Receipt },
    { href: "/admin/attendants", label: "Staffs", icon: lucide_react_1.Store },
    { href: "/admin/orders", label: "Orders", icon: lucide_react_1.Package },
    { href: "/admin/receipts", label: "Receipts", icon: lucide_react_1.FileText },
    { href: "/admin/marketing-report?impersonateId=cmimxqf9t0003v5mcjdq8x61p", label: "SalesOps", icon: lucide_react_1.Truck },
    { href: "/admin/returns/jumia", label: "Jumia Returns", icon: lucide_react_1.Truck },
    { href: "/admin/catalog", label: "Catalog", icon: lucide_react_1.Layers },
    { href: "/admin/marketing-report", label: "Marketing report", icon: lucide_react_1.BarChart3 },
    { href: "/admin/support-report", label: "Support report", icon: lucide_react_1.LifeBuoy },
    { href: "/admin/reports", label: "Reports", icon: lucide_react_1.FileText },
    { href: "/admin/settings", label: "Settings", icon: lucide_react_1.Settings },
];
