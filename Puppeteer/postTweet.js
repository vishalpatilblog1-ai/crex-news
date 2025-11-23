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

  // 🔥 Ensure Puppeteer is ready
  await initPuppeteer();

  const page = getPage();
  if (!page) {
    throw new Error("❌ Puppeteer page not ready.");
  }

  console.log("📝 Opening X compose page…");
  await page.goto("https://x.com/compose/post", {
    waitUntil: "networkidle2",
  });

  const textboxSelectors = [
    'div[data-testid="tweetTextarea_0"]',
    'div[data-testid="tweetTextarea_1"]',
    'div[role="textbox"]',
    "div.public-DraftStyleDefault-block",
    "div.DraftEditor-editorContainer",
    'div[aria-label="Tweet text"]',
  ];

  let textboxFound = false;

  for (const sel of textboxSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 8000 });
      console.log(`🟢 Found textbox: ${sel}`);

      await page.click(sel);

      // Clear old text
      const isMac = process.platform === "darwin";
      await page.keyboard.down(isMac ? "Meta" : "Control");
      await page.keyboard.press("KeyA");
      await page.keyboard.up(isMac ? "Meta" : "Control");
      await page.keyboard.press("Backspace");

      await page.type(sel, text, { delay: 20 });

      textboxFound = true;
      break;
    } catch {}
  }

  if (!textboxFound) {
    console.log("❌ No textbox found.");
    return;
  }

  const tweetButtonSelectors = [
    'div[data-testid="tweetButtonInline"]',
    'button[data-testid="tweetButtonInline"]',
    'div[data-testid="tweetButton"]',
    'button[data-testid="tweetButton"]',
  ];

  for (const btnSel of tweetButtonSelectors) {
    try {
      await page.waitForSelector(btnSel, { timeout: 5000 });
      console.log(`🟢 Clicking tweet button: ${btnSel}`);
      await page.click(btnSel);
      console.log("📤 Tweet submitted!");
      break;
    } catch {}
  }

  // await page.waitForTimeout(3000);
  await new Promise((res) => setTimeout(res, 3000));
}
