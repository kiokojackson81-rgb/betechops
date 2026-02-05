"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ClientRedirect;
const react_1 = require("react");
const react_2 = require("next-auth/react");
const navigation_1 = require("next/navigation");
const helpers_1 = require("../lib/auth/helpers");
function ClientRedirect() {
    const { data: session, status } = (0, react_2.useSession)();
    const router = (0, navigation_1.useRouter)();
    (0, react_1.useEffect)(() => {
        if (status === "loading")
            return;
        if (!session) {
            // Not signed in — send to signin page
            router.replace("/api/auth/signin");
            return;
        }
        // session.user may contain attendantCategory from NextAuth callbacks
        // Fallback to root if missing
        // @ts-expect-error - session.user may include attendantCategory even if typing says otherwise
        const category = session.user?.attendantCategory ?? null;
        const dest = (0, helpers_1.getLandingPage)(category);
        router.replace(dest);
    }, [session, status, router]);
    return null;
}
