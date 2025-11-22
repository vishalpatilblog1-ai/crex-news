import { startBrowser } from "./browser.js";
import fs from "fs";

let browser = null;
let page = null;

export async function initPuppeteer() {
  console.log("➡ Initializing Puppeteer…");

  const result = await startBrowser();
  browser = result.browser;
  page = result.page;

  return page;
}

export async function postTweet(text) {
  if (!browser || !page) {
    await initPuppeteer();
  }

  try {
    console.log("📝 Posting tweet…");

    await page.goto("https://x.com/compose/tweet", {
      waitUntil: "networkidle2",
    });

    await page.waitForSelector("div[role='textbox']");
    await page.type("div[role='textbox']", text, { delay: 20 });

    await page.click("div[data-testid='tweetButton']");
    console.log("✅ Tweet posted!");
  } catch (err) {
    console.log("❌ Error posting tweet:", err.message);
  }
}
