// Puppeteer/postTweet.js
import { startBrowser, getPage } from "./browser.js";

let initialized = false;

/** -------------------------------
 *  🚀 Initialize Puppeteer once
 *--------------------------------*/
export async function initPuppeteer() {
  if (!initialized) {
    console.log("🚀 Starting Puppeteer browser…");
    await startBrowser();
    initialized = true;
  }
}

/** -------------------------------
 *  🟦 Console-only Tweet
 *  (used for local simulation)
 *--------------------------------*/
export async function postTweet_console(text) {
  if (!text?.trim()) {
    console.log("⚠ Empty tweet skipped (console mode)");
    return;
  }

  console.log("\n=============================");
  console.log("🟦 AI TWEET (CONSOLE MODE):");
  console.log(text);
  console.log("=============================\n");
}

/** -------------------------------
 *  🌐 Real Web Tweet via Puppeteer
 *--------------------------------*/
export async function postTweet_web(text) {
  if (!text?.trim()) {
    console.log("⚠ Empty tweet skipped (web mode)");
    return;
  }

  await initPuppeteer();
  const page = getPage();
  if (!page) throw new Error("❌ Puppeteer page not ready.");

  console.log("📝 Opening X compose page…");
  await page.goto("https://x.com/compose/post", {
    waitUntil: "networkidle2",
  });

  // Possible textbox selectors (X changes DOM frequently)
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
      console.log("🟢 Found textbox:", sel);

      // Focus
      await page.click(sel);

      // Clear any existing text
      await page.keyboard.down("Meta");
      await page.keyboard.press("A");
      await page.keyboard.up("Meta");
      await page.keyboard.press("Backspace");

      // Type tweet
      await page.type(sel, text, { delay: 10 });
      typed = true;
      break;
    } catch {}
  }

  if (!typed) {
    console.log("❌ ERROR: Could not find tweet text box.");
    return;
  }

  // Submit via keyboard shortcut (CMD + ENTER)
  await page.keyboard.down("Meta");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Meta");

  console.log("📤 Tweet SUBMITTED!");

  await new Promise((r) => setTimeout(r, 1200));

  console.log("🟢 Tweet posted!");
}
