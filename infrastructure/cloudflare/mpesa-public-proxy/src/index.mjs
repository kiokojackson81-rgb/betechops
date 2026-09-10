const BACKEND_ORIGIN = "https://www.betech.co.ke";

const ALLOWED_PATHS = new Set([
  "/api/mpesa/stk/push",
  "/api/mpesa/stk/callback",
  "/api/mpesa/c2b/validation",
  "/api/mpesa/c2b/confirmation",
]);

export default {
  async fetch(request) {
    const incoming = new URL(request.url);

    if (!ALLOWED_PATHS.has(incoming.pathname)) {
      return new Response("Not found", { status: 404 });
    }

    // Keep the request method, headers and body intact. Constructing a Request
    // from the original request streams the original POST body to the backend;
    // it is never parsed, re-serialized, or redirected through ops.
    const backend = new URL(incoming.pathname + incoming.search, BACKEND_ORIGIN);
    const upstreamRequest = new Request(backend, request);
    return fetch(upstreamRequest, { redirect: "manual" });
  },
};
