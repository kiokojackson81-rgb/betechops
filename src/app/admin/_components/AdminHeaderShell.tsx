"use client";

import React, { useEffect, useState } from "react";

export default function AdminHeaderShell({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let revealTimer: ReturnType<typeof setTimeout> | null = null;

    function onScroll() {
      const currentY = window.scrollY;

      if (currentY <= 24) {
        setHidden(false);
        if (revealTimer) {
          clearTimeout(revealTimer);
          revealTimer = null;
        }
        return;
      }

      setHidden(true);

      if (revealTimer) {
        clearTimeout(revealTimer);
      }

      revealTimer = setTimeout(() => {
        setHidden(false);
        revealTimer = null;
      }, 180);
    }

    function onPointerLeaveViewport() {
      if (window.scrollY <= 24) {
        setHidden(false);
        return;
      }

      if (revealTimer) {
        clearTimeout(revealTimer);
        revealTimer = null;
      }

      setHidden(false);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mouseup", onPointerLeaveViewport);
    window.addEventListener("touchend", onPointerLeaveViewport);

    return () => {
      if (revealTimer) {
        clearTimeout(revealTimer);
      }
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mouseup", onPointerLeaveViewport);
      window.removeEventListener("touchend", onPointerLeaveViewport);
    };
  }, []);

  return (
    <div
      className={
        "sticky top-0 z-50 shadow-lg shadow-black/30 transition-transform duration-300 ease-out " +
        (hidden ? "-translate-y-full" : "translate-y-0")
      }
    >
      {children}
    </div>
  );
}
