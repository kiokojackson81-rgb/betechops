export type Role = "ADMIN" | "SUPERVISOR" | "ATTENDANT";

export const isAdmin = (r?: string) => r === "ADMIN";
export const isSupervisor = (r?: string) => r === "SUPERVISOR";
export const isAttendant = (r?: string) => r === "ATTENDANT" || r === "SUPERVISOR";
