"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle, X } from "lucide-react";

const GROUP_LINK = "https://chat.whatsapp.com/K6TBwpEpCKP29sIks5KosZ";
const SESSION_KEY = "betech_agent_whatsapp_prompt_seen";
const MICRO_TEXT = [
  "Agents are joining across Kenya",
  "Get product updates first",
  "Refer customers and earn commission",
  "Access reseller support on WhatsApp",
];

export default function AgentWhatsAppFloat() {
  const [expanded, setExpanded] = useState(false);
  const [peek, setPeek] = useState(false);
  const [microIndex, setMicroIndex] = useState(0);

  const isMobile = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1023px)").matches;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPeek(true);
      window.setTimeout(() => setPeek(false), 1800);
    }, 10000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMicroIndex((current) => (current + 1) % MICRO_TEXT.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const onScroll = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll <= 0) return;
      const progress = window.scrollY / maxScroll;
      if (progress >= 0.25) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setExpanded(true);
        window.setTimeout(() => setExpanded(false), 4000);
        window.removeEventListener("scroll", onScroll);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isMobile]);

  const handleJoinClick = () => {
    if (typeof window !== "undefined") {
      const maybeGtag = (window as typeof window & { gtag?: (...args: unknown[]) => void }).gtag;
      maybeGtag?.("event", "agent_whatsapp_join_click", {
        event_category: "engagement",
        event_label: "agent_whatsapp_float",
      });
      window.open(GROUP_LINK, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+7.25rem)] right-3 z-[70] sm:bottom-6 sm:right-6">
        <div className="relative flex flex-col items-end gap-3">
          {expanded ? (
            <div className="agent-wa-card w-[15.25rem] max-w-[calc(100vw-1.25rem)] rounded-[1.6rem] border border-[#7a0000]/12 bg-[linear-gradient(180deg,#fffaf1_0%,#ffffff_100%)] p-4 text-slate-950 shadow-[0_24px_60px_rgba(15,23,42,0.22)] sm:w-[20rem] sm:max-w-[calc(100vw-2rem)] sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex rounded-full bg-[#fff3d8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#7a0000]">
                    WhatsApp Community
                  </div>
                  <h3 className="mt-3 text-xl font-black leading-tight text-[#7a0000]">
                    Join Betech Agents Community
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Close WhatsApp community widget"
                  onClick={() => setExpanded(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#7a0000]/10 bg-white text-slate-500 transition hover:border-[#7a0000]/20 hover:text-[#7a0000]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600 sm:mt-4 sm:leading-7">
                Get product updates, reseller deals, sales tips, and commission opportunities directly on WhatsApp.
              </p>

              <div className="mt-3 rounded-2xl border border-[#f2b20f]/18 bg-[#fff8e7] px-4 py-3 text-sm font-semibold text-[#7a0000] sm:mt-4">
                {MICRO_TEXT[microIndex]}
              </div>

              <div className="mt-3 grid gap-2 text-sm font-medium text-slate-700 sm:mt-4">
                <div>✅ Agent support</div>
                <div>✅ Product updates</div>
                <div>✅ Reseller deals</div>
                <div>✅ Commission tips</div>
              </div>

              <button
                type="button"
                aria-label="Join Betech Agents WhatsApp community"
                onClick={handleJoinClick}
                className="mt-4 inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#11b86a_0%,#0f9d58_55%,#0b7c44_100%)] px-4 py-3 text-sm font-bold text-white shadow-[0_18px_38px_rgba(15,157,88,0.30)] transition hover:-translate-y-0.5 sm:mt-5 sm:min-h-[3.5rem] sm:px-5 sm:text-base"
              >
                <MessageCircle className="h-5 w-5" />
                Join WhatsApp Group
              </button>
            </div>
          ) : null}

          <button
            type="button"
            aria-label="Join Betech Agents WhatsApp community"
            onClick={() => setExpanded((current) => !current)}
            className={`agent-wa-float relative inline-flex min-h-[3rem] max-w-[230px] items-center gap-2 overflow-hidden rounded-full border border-[#f2b20f]/22 bg-[linear-gradient(135deg,#16c768_0%,#0f9d58_55%,#0c8349_100%)] px-3 py-2 text-left text-white shadow-[0_20px_45px_rgba(15,157,88,0.28)] transition duration-300 hover:-translate-y-0.5 sm:min-h-[3.75rem] sm:max-w-[260px] sm:gap-3 sm:px-4 sm:py-3 ${
              peek ? "ring-4 ring-[#f2b20f]/25" : ""
            }`}
          >
            <span className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-[#f2b20f]/25" />
            <span className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(242,178,15,0.18),transparent_60%)] opacity-80" />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-white sm:h-10 sm:w-10">
              <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <span className="relative max-w-[9rem] sm:max-w-none">
              <span className="block text-[11px] font-black uppercase tracking-[0.12em] sm:text-sm">Join Agent Network</span>
              <span className="block text-[11px] text-white/85 sm:text-xs">WhatsApp community</span>
            </span>
          </button>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes waFloat {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-6px); }
            }

            @keyframes waPulse {
              0%, 100% { box-shadow: 0 20px 45px rgba(15,157,88,0.28), 0 0 0 0 rgba(242,178,15,0.18); }
              50% { box-shadow: 0 20px 45px rgba(15,157,88,0.32), 0 0 0 10px rgba(242,178,15,0); }
            }

            @keyframes waCardIn {
              0% { opacity: 0; transform: translateY(12px) scale(0.97); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }

            .agent-wa-float {
              animation: waFloat 5.5s ease-in-out infinite, waPulse 4.5s ease-in-out infinite;
            }

            .agent-wa-card {
              animation: waCardIn 220ms ease-out;
            }
          `,
        }}
      />
    </>
  );
}
