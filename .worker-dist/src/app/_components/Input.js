"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Input;
const jsx_runtime_1 = require("react/jsx-runtime");
function Input(props) {
    const { className = "", ...rest } = props;
    return (0, jsx_runtime_1.jsx)("input", { ...rest, className: `rounded border px-2 py-1 w-full ${className}` });
}
