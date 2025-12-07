"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Checkbox;
const jsx_runtime_1 = require("react/jsx-runtime");
function Checkbox({ checked = false, onCheckedChange, className = "" }) {
    return ((0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: checked, onChange: (e) => onCheckedChange && onCheckedChange(e.target.checked), className: `w-4 h-4 rounded ${className}` }));
}
