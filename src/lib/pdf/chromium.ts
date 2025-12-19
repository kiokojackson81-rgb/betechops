import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export async function launchChromiumBrowser() {
  const executablePath = await chromium.executablePath();

  console.info("[pdf][chromium] resolved", {
    executablePath: executablePath?.slice(0, 100),
    argsLength: chromium.args.length,
    headless: (chromium as any).headless,
  });

  return puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: (chromium as any).defaultViewport,
    executablePath,
    headless: typeof (chromium as any).headless === "boolean" ? (chromium as any).headless : true,
  });
}
