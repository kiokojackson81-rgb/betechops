"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ClientRedirect;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_2 = require("next-auth/react");
const navigation_1 = require("next/navigation");
const getLandingPage_1 = __importDefault(require("@/lib/getLandingPage"));
function ClientRedirect() {
    const router = (0, navigation_1.useRouter)();
    const _sess = (0, react_2.useSession)();
    const session = _sess?.data;
    const status = _sess?.status;
    (0, react_1.useEffect)(() => {
        if (status === "loading")
            return;
        if (!session) {
            router.replace("/attendant/login");
            return;
        }
        const user = session.user;
        let role = user?.role || "ATTENDANT";
        const params = new URLSearchParams(window.location.search);
        const intended = params.get("intended");
        if (intended === "admin" && role === "ADMIN") {
            router.replace("/admin");
            return;
        }
        if (intended === "attendant") {
            router.replace("/attendant");
            return;
        }
        // Always refresh attendantCategory from the server (no-cache) to avoid stale tokens.
        (async () => {
            try {
                let category = user?.attendantCategory ?? null;
                const res = await fetch("/api/attendants/me", {
                    credentials: "same-origin",
                    cache: "no-store",
                });
                if (res.ok) {
                    const json = await res.json();
                    category = json?.attendantCategory ?? category;
                    role = json?.role ?? role;
                }
                let target = (0, getLandingPage_1.default)(category, role);
                if (user?.email?.toLowerCase() === "jeniffer@betech.co.ke" && target === "/attendant") {
                    target = "/marketing/tracker";
                }
                router.replace(target);
            }
            catch (e) {
                let target = (0, getLandingPage_1.default)(user?.attendantCategory ?? null, role);
                if (user?.email?.toLowerCase() === "jeniffer@betech.co.ke" && target === "/attendant") {
                    target = "/marketing/tracker";
                }
                router.replace(target);
            }
        })();
    }, [session, status, router]);
    return ((0, jsx_runtime_1.jsx)("div", { className: "p-8", children: (0, jsx_runtime_1.jsx)("p", { className: "text-center", children: "Signing you in - redirecting..." }) }));
}
