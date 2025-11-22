// Puppeteer/postTweet.js
import { startBrowser, getPage } from "./browser.js";

let initialized = false;

export async function initPuppeteer() {
  if (!initialized) {
    await startBrowser();
    initialized = true;
  }
}

export async function postTweet(text) {
  if (!text || !text.trim()) {
    console.log("⚠ Empty tweet skipped");
    return;
  }

  const page = getPage();
  if (!page) {
    throw new Error("Puppeteer page not ready. Call initPuppeteer() first.");
  }

  console.log("📝 Opening X compose page…");

  await page.goto("https://x.com/compose/post", {
    waitUntil: "networkidle2",
  });

  // Wait for the tweet textbox
  await page.waitForSelector('div[role="textbox"]', { timeout: 20000 });

  const textboxSelector = 'div[role="textbox"]';

  // Focus and clear existing text
  await page.click(textboxSelector);
  // CMD/CTRL + A then delete
  const isMac = process.platform === "darwin";
  await page.keyboard.down(isMac ? "Meta" : "Control");
  await page.keyboard.press("KeyA");
  await page.keyboard.up(isMac ? "Meta" : "Control");
  await page.keyboard.press("Backspace");

  // Type tweet
  await page.type(textboxSelector, text);

  // Click Post/Tweet button
  const buttonSelectors = [
    'div[data-testid="tweetButtonInline"]',
    'div[data-testid="tweetButton"]',
    'button[data-testid="tweetButtonInline"]',
  ];

  let clicked = false;
  for (const sel of buttonSelectors) {
    const btn = await page.$(sel);
    if (btn) {
      await btn.click();
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    console.log("❌ Could not find tweet button");
    return;
  }

  console.log("📤 Tweet submitted, waiting a bit…");
  await page.waitForTimeout(4000);
}
