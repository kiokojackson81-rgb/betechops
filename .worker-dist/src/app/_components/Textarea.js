"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Textarea;
const jsx_runtime_1 = require("react/jsx-runtime");
function Textarea(props) {
    const { className = "", rows = 3, ...rest } = props;
    return (0, jsx_runtime_1.jsx)("textarea", { rows: rows, ...rest, className: `rounded border px-2 py-1 w-full ${className}` });
}
