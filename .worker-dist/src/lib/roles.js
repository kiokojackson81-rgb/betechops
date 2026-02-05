"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAttendant = exports.isSupervisor = exports.isAdmin = void 0;
const isAdmin = (r) => r === "ADMIN";
exports.isAdmin = isAdmin;
const isSupervisor = (r) => r === "SUPERVISOR";
exports.isSupervisor = isSupervisor;
const isAttendant = (r) => r === "ATTENDANT" || r === "SUPERVISOR";
exports.isAttendant = isAttendant;
