// Simple auth helper for audit logging
export function getSession() {
  // For now, return a default session. This can be enhanced later with real auth
  return {
    id: "default-attendant",
    role: "attendant",
  };
}