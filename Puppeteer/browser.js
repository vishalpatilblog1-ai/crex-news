import puppeteer from "puppeteer";
import fs from "fs";

let browser = null;
let page = null;

const COOKIES_PATH = "./x-cookies.json";

export async function startBrowser() {
  console.log("➡ Initializing Puppeteer…");

  browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    userDataDir: "./chrome-data",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-web-security",
      "--disable-dev-shm-usage",
    ],
  });

  console.log("➡ Launching Chrome…");

  const pages = await browser.pages();
  page = pages.length ? pages[0] : await browser.newPage();

  // Load cookies if present
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, "utf8"));
    await page.setCookie(...cookies);
    console.log("🍪 Cookies loaded. Logged in session restored.");
  }

  return { browser, page };
}

// Alias — so both old and new code work
export const initBrowser = startBrowser;

export function getBrowser() {
  return browser;
}

export function getPage() {
  return page;
}
