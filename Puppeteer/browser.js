// Puppeteer/browser.js
import puppeteer from "puppeteer";
import fs from "fs";

let browser = null;
let page = null;

const CHROME_PATH =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const COOKIES_PATH = "./x-cookies.json";

export async function startBrowser() {
  if (browser) return { browser, page };

  console.log("➡ Initializing Puppeteer…");

  browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    userDataDir: "./Puppeteer/chrome-profile",
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--start-maximized",
    ],
  });

  console.log("➡ Launching Chrome…");

  const pages = await browser.pages();
  page = pages.length ? pages[0] : await browser.newPage();

  // 🔥 Attach auto-dialog handler AFTER page exists
  page.on("dialog", async (dialog) => {
    console.log("⚠️ Auto-handling dialog:", dialog.message());
    try {
      await dialog.accept(); // always accept "Leave site?" popup
    } catch (_) {}
  });

  // Load cookies
  if (fs.existsSync(COOKIES_PATH)) {
    try {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, "utf8"));
      await page.setCookie(...cookies);
      console.log("🍪 Cookies loaded. Logged-in session restored.");
    } catch (err) {
      console.log("⚠ Error loading cookies:", err);
    }
  } else {
    console.log("⚠ x-cookies.json not found. Run login.js once.");
  }

  return { browser, page };
}

export function getPage() {
  return page;
}
