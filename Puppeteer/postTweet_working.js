// Puppeteer/postTweet.js
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

  // 🔥 Type tweet (with fallback selectors)
  const textboxSelectors = [
    'div[data-testid="tweetTextarea_0"]',
    'div[data-testid="tweetTextarea_1"]',
    'div[role="textbox"]',
    'div[aria-label="Tweet text"]',
  ];

  let typed = false;

  for (const sel of textboxSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      console.log("🟢 Found textbox:", sel);

      await page.click(sel);

      // Clear
      const isMac = process.platform === "darwin";
      await page.keyboard.down(isMac ? "Meta" : "Control");
      await page.keyboard.press("KeyA");
      await page.keyboard.up(isMac ? "Meta" : "Control");
      await page.keyboard.press("Backspace");

      // Type tweet
      await page.type(sel, text, { delay: 15 });
      typed = true;
      break;
    } catch {}
  }

  if (!typed) {
    console.log("❌ Could not find tweet box");
    return;
  }

  // 🔥 Try clicking tweet button
  const tweetButtons = [
    'div[data-testid="tweetButtonInline"]',
    'button[data-testid="tweetButtonInline"]',
    'div[data-testid="tweetButton"]',
    'button[data-testid="tweetButton"]',
  ];

  let clicked = false;

  for (const btn of tweetButtons) {
    try {
      await page.waitForSelector(btn, { timeout: 4000 });
      console.log("🟢 Clicking tweet button:", btn);
      await page.click(btn);
      clicked = true;
      break;
    } catch {}
  }

  if (!clicked) {
    console.log("❌ Could not click tweet button");
  } else {
    console.log("📤 Tweet submitted!");
  }

  // ⏳ Replace waitForTimeout
  await new Promise((res) => setTimeout(res, 2000));
}
