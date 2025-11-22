// Puppeteer/browser.js
import puppeteer from "puppeteer";
import fs from "fs";

let browser = null;
let page = null;

const COOKIES_PATH = "./x-cookies.json";

export async function startBrowser() {
  if (browser) return { browser, page };

  console.log("➡ Initializing Puppeteer…");

  browser = await puppeteer.launch({
    headless: process.env.HEADLESS !== "false",
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    ],
  });

  console.log("➡ Launching Chrome…");

  const pages = await browser.pages();
  page = pages.length ? pages[0] : await browser.newPage();

  // Load cookies if present
  if (fs.existsSync(COOKIES_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, "utf8"));
    await page.setCookie(...cookies);
    console.log("🍪 Cookies loaded. Logged-in session restored.");
  } else {
    console.log("⚠ x-cookies.json not found. Run login.js once.");
  }

  return { browser, page };
}

export function getBrowser() {
  return browser;
}

export function getPage() {
  return page;
}
