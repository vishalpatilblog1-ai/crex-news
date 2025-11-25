// Puppeteer/postTweet.js

import { createLogger } from "../utils/logger.js";
import { startBrowser, getPage } from "./browser.js";

let initialized = false;
const log = createLogger("local");

export async function initPuppeteer() {
  if (!initialized) {
    await startBrowser();
    initialized = true;
  }
}

export async function postTweet_console(text) {
  if (!text?.trim()) {
    log("⚠ Empty tweet skipped (console mode)");
    return;
  }

  log("=============================");
  log("🟦 AI TWEET (CONSOLE MODE):");
  log("=============================");
  log(text);
}

export async function postTweet_web(text) {
  if (!text?.trim()) {
    log("⚠ Empty tweet skipped (web mode)");
    return;
  }

  await initPuppeteer();
  const page = getPage();
  if (!page) throw new Error("❌ Puppeteer page not ready.");

  log("📝 Opening X compose page…");
  await page.goto("https://x.com/compose/post", {
    waitUntil: "networkidle2",
  });

  const textboxSelectors = [
    'div[data-testid="tweetTextarea_0"]',
    'div[data-testid="tweetTextarea_1"]',
    'div[role="textbox"]',
    'div[aria-label="Tweet text"]',
  ];

  let typed = false;

  for (const sel of textboxSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 6000 });
      log("🟢 Found textbox:", sel);

      await page.click(sel);

      await page.keyboard.down("Meta");
      await page.keyboard.press("A");
      await page.keyboard.up("Meta");
      await page.keyboard.press("Backspace");

      await page.type(sel, text, { delay: 10 });
      typed = true;
      break;
    } catch {}
  }

  if (!typed) {
    log("❌ ERROR: Could not find tweet text box.");
    return;
  }

  // Submit via keyboard shortcut (CMD + ENTER)
  await page.keyboard.down("Meta");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Meta");

  log("📤 Tweet SUBMITTED!");

  await new Promise((r) => setTimeout(r, 1200));

  log("🟢 Tweet posted!");
}
