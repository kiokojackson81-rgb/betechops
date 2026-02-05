"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchChromiumBrowser = launchChromiumBrowser;
const chromium_1 = __importDefault(require("@sparticuz/chromium"));
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
async function launchChromiumBrowser() {
    const executablePath = await chromium_1.default.executablePath();
    console.info("[pdf][chromium] resolved", {
        executablePath: executablePath?.slice(0, 100),
        argsLength: chromium_1.default.args.length,
        headless: chromium_1.default.headless,
    });
    return puppeteer_core_1.default.launch({
        args: [...chromium_1.default.args, "--no-sandbox", "--disable-setuid-sandbox"],
        defaultViewport: chromium_1.default.defaultViewport,
        executablePath,
        headless: typeof chromium_1.default.headless === "boolean" ? chromium_1.default.headless : true,
    });
}
