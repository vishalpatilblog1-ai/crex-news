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
    throw new Error("❌ Puppeteer page not ready. Call initPuppeteer() first.");
  }

  console.log("📝 Opening X compose page…");

  await page.goto("https://x.com/compose/post", {
    waitUntil: "networkidle2",
  });

  // Possible textbox selectors (X keeps changing)
  const textboxSelectors = [
    'div[role="textbox"]',
    "div.public-DraftStyleDefault-block",
    "div.DraftEditor-editorContainer",
    'div[aria-label="Tweet text"]',
    'div[data-testid="tweetTextarea_0"]',
  ];

  let textboxFound = false;

  for (const sel of textboxSelectors) {
    try {
      await page.waitForSelector(sel, { timeout: 5000 });
      console.log(`🟢 Found textbox using selector: ${sel}`);
      await page.click(sel);
      textboxFound = true;

      // Clear any default text
      const isMac = process.platform === "darwin";
      await page.keyboard.down(isMac ? "Meta" : "Control");
      await page.keyboard.press("KeyA");
      await page.keyboard.up(isMac ? "Meta" : "Control");
      await page.keyboard.press("Backspace");

      // Type tweet
      await page.type(sel, text, { delay: 20 });
      break;
    } catch (err) {}
  }

  if (!textboxFound) {
    console.log("❌ Could not find textbox in compose page");
    return;
  }

  // Tweet button selectors
  const tweetButtonSelectors = [
    'div[data-testid="tweetButtonInline"]',
    'button[data-testid="tweetButtonInline"]',
    'div[data-testid="tweetButton"]',
    'button[data-testid="tweetButton"]',
  ];

  let buttonClicked = false;

  for (const btnSel of tweetButtonSelectors) {
    const btn = await page.$(btnSel);
    if (btn) {
      console.log(`🟢 Clicking Post button: ${btnSel}`);
      await btn.click();
      buttonClicked = true;
      break;
    }
  }

  if (!buttonClicked) {
    console.log("❌ Could not find any tweet/post button.");
    return;
  }

  console.log("📤 Tweet submitted, waiting for confirmation…");
  await page.waitForTimeout(5000);
}
