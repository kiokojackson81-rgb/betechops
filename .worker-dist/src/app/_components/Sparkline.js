"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Sparkline;
const jsx_runtime_1 = require("react/jsx-runtime");
function Sparkline({ values = [], color = "var(--primary)", width = 120, height = 28, }) {
    const w = width;
    const h = height;
    if (!values || values.length === 0)
        return (0, jsx_runtime_1.jsx)("svg", { width: w, height: h });
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = w / Math.max(1, values.length - 1);
    const points = values.map((v, i) => {
        const x = Math.round(i * step);
        const y = Math.round(h - ((v - min) / range) * h);
        return `${x},${y}`;
    });
    return ((0, jsx_runtime_1.jsx)("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: "none", children: (0, jsx_runtime_1.jsx)("polyline", { fill: "none", stroke: color, strokeWidth: 2, points: points.join(" "), strokeLinecap: "round", strokeLinejoin: "round" }) }));
}
