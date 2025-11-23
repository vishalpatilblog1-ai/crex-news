// Puppeteer/postTweet.js (MAC VERSION — uses CMD + ENTER)
import { startBrowser, getPage } from "./browser.js";

let initialized = false;

export async function initPuppeteer() {
  if (!initialized) {
    console.log("🚀 Starting Puppeteer browser…");
    await startBrowser();
    initialized = true;
  }
}

export async function postTweet(text) {
  if (!text || !text.trim()) {
    console.log("⚠ Empty tweet skipped");
    return;
  }

  await initPuppeteer();
  const page = getPage();
  if (!page) throw new Error("❌ Puppeteer page not ready.");

  console.log("📝 Opening X compose page…");
  await page.goto("https://x.com/compose/post", {
    waitUntil: "networkidle2",
  });

  // ---- STEP 1: FIND TEXTBOX ----
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

      await page.click(sel);

      // Clear existing text
      await page.keyboard.down("Meta");
      await page.keyboard.press("A");
      await page.keyboard.up("Meta");
      await page.keyboard.press("Backspace");

      // Type tweet
      await page.type(sel, text, { delay: 12 });
      typed = true;

      break;
    } catch {}
  }

  if (!typed) {
    console.log("❌ ERROR: Could not find tweet text box.");
    return;
  }

  // ---- STEP 2: POST USING CMD + ENTER ----
  console.log("⌨️  Submitting tweet using CMD + ENTER…");

  await page.keyboard.down("Meta");
  await page.keyboard.press("Enter");
  await page.keyboard.up("Meta");

  console.log("📤 Tweet SUBMITTED (keyboard shortcut).");

  // await page.waitForTimeout(1500);
  await new Promise((res) => setTimeout(res, 1500));

  console.log("🟢 Tweet posted!");
}
