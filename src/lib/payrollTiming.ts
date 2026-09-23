/** Lightweight observability for payroll read paths. Safe for production logs. */
export function startPayrollTiming(endpoint: string) {
  const startedAt = performance.now();
  return {
    finish<T extends Response>(response: T): T {
      const durationMs = performance.now() - startedAt;
      response.headers.set("Server-Timing", `payroll;dur=${durationMs.toFixed(1)}`);
      console.info("[payroll-timing]", { endpoint, durationMs: Number(durationMs.toFixed(1)) });
      return response;
    },
  };
}
