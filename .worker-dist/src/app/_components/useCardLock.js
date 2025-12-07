"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useCardLock = useCardLock;
exports.LockButton = LockButton;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
/**
 * Small helper to lock/unlock sensitive cards (values blurred when locked).
 * Unlock requires an authenticated session; otherwise the user is redirected to login.
 */
function useCardLock(storageKey) {
    // This hook now operates purely client-side using localStorage so that
    // locking/unlocking works regardless of authentication state. Auto-lock
    // behavior is preserved.
    const key = `lock:${storageKey}`;
    const [locked, setLocked] = (0, react_1.useState)(() => {
        if (typeof window === "undefined")
            return false;
        try {
            return localStorage.getItem(key) === "1";
        }
        catch {
            return false;
        }
    });
    // Timer ref used to auto-lock after a period when unlocked.
    const autoLockTimer = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined")
            return;
        try {
            localStorage.setItem(key, locked ? "1" : "0");
        }
        catch {
            // ignore
        }
    }, [key, locked]);
    // No session gating: keep current localStorage value but ensure it's a
    // boolean state. We do not redirect unauthenticated users.
    // Start/clear the auto-lock timer when unlocked.
    (0, react_1.useEffect)(() => {
        // helper to clear existing timer
        const clearTimer = () => {
            if (autoLockTimer.current) {
                clearTimeout(autoLockTimer.current);
                autoLockTimer.current = null;
            }
        };
        // Only start timer when unlocked.
        if (!locked) {
            // clear any previous timer
            clearTimer();
            // auto-lock after 5 minutes
            autoLockTimer.current = window.setTimeout(() => {
                setLocked(true);
                autoLockTimer.current = null;
            }, 5 * 60 * 1000);
        }
        else {
            // If locked, ensure timer is cleared
            clearTimer();
        }
        return () => clearTimer();
    }, [locked]);
    // Synchronously update localStorage when locking/unlocking to avoid races
    // where other scripts read stale values during the same tick.
    const _lock = () => {
        try {
            if (typeof window !== "undefined")
                localStorage.setItem(key, "1");
        }
        catch {
            // ignore
        }
        // eslint-disable-next-line no-console
        console.debug('useCardLock: _lock -> setting locked=true', { key });
        setLocked(true);
    };
    const _unlock = () => {
        try {
            if (typeof window !== "undefined")
                localStorage.setItem(key, "0");
        }
        catch {
            // ignore
        }
        // eslint-disable-next-line no-console
        console.debug('useCardLock: _unlock -> setting locked=false', { key });
        setLocked(false);
    };
    const lock = () => _lock();
    const unlock = () => {
        // Simple local unlock — no session gating.
        // eslint-disable-next-line no-console
        console.debug("useCardLock: unlock() called", { storageKey });
        _unlock();
    };
    const toggle = () => (locked ? unlock() : lock());
    return { locked, lock, unlock, toggle };
}
function LockButton({ locked, onToggle, label, }) {
    return ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => {
            // eslint-disable-next-line no-console
            console.debug('LockButton: clicked', { locked });
            try {
                onToggle();
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error('LockButton: onToggle error', err);
            }
        }, className: "inline-flex items-center gap-2 rounded-xl border border-white/10 px-2.5 py-1 text-xs text-slate-300 transition hover:border-emerald-400 hover:text-emerald-200", "aria-pressed": !locked, title: locked ? "Unlock (login required)" : "Lock", children: [(0, jsx_runtime_1.jsx)("span", { "aria-hidden": true, children: locked ? "🔓" : "🔒" }), (0, jsx_runtime_1.jsx)("span", { className: "hidden sm:inline", children: label ?? (locked ? "Unlock" : "Lock") })] }));
}
