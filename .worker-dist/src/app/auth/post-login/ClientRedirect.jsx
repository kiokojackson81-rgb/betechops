"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ClientRedirect;
const react_1 = __importStar(require("react"));
const react_2 = require("next-auth/react");
const navigation_1 = require("next/navigation");
function ClientRedirect() {
    const router = (0, navigation_1.useRouter)();
    const { data: session, status } = (0, react_2.useSession)();
    (0, react_1.useEffect)(() => {
        var _a;
        if (status === "loading")
            return;
        if (!session) {
            router.replace("/attendant/login");
            return;
        }
        const role = ((_a = session.user) === null || _a === void 0 ? void 0 : _a.role) || "ATTENDANT";
        // Read intended param from URL. If present, prefer it (but validate against role)
        const params = new URLSearchParams(window.location.search);
        const intended = params.get("intended");
        if (intended === "admin" && role === "ADMIN") {
            router.replace("/admin");
            return;
        }
        if (intended === "attendant") {
            // If intended is attendant, allow redirect to attendant regardless of role
            router.replace("/attendant");
            return;
        }
        // Default: role-based routing
        if (role === "ADMIN")
            router.replace("/admin");
        else
            router.replace("/attendant");
    }, [session, status, router]);
    return (<div className="p-8">
      <p className="text-center">Signing you in — redirecting...</p>
    </div>);
}
