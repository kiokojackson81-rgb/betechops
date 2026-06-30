import { headers } from "next/headers";
import { isAgentsHost, isOpsHost } from "@/lib/runtimeUrls";

const BLOCKED_PUBLIC_BOTS = [
  "Amazonbot",
  "SemrushBot",
  "MJ12bot",
  "AhrefsBot",
  "DotBot",
  "Bytespider",
  "PetalBot",
  "CCBot",
];

export async function GET() {
  const host = (await headers()).get("host");

  if (isAgentsHost(host) || isOpsHost(host)) {
    return new Response("User-agent: *\nDisallow: /\n", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      },
    });
  }

  const lines = [
    "User-agent: *",
    "Disallow: /*?*",
    "Disallow: /all-products?*",
    "Disallow: /products?*",
    "Disallow: /category/*?*",
    "",
    ...BLOCKED_PUBLIC_BOTS.flatMap((bot) => [`User-agent: ${bot}`, "Disallow: /", ""]),
  ];

  return new Response(`${lines.join("\n").trim()}\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
