// Puppeteer/login.js
import puppeteer from "puppeteer";
import fs from "fs";

const CHROME_PATH =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function loginX() {
  console.log("➡ Opening Chrome for login…");

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: CHROME_PATH,
    userDataDir: "./Puppeteer/chrome-profile",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
  });

  const pages = await browser.pages();
  const page = pages.length ? pages[0] : await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  console.log("➡ Opening login page…");
  await page.goto("https://x.com/login", { waitUntil: "networkidle2" });

  console.log("➡ Please login manually.");
  console.log(
    "➡ After login finishes and your feed loads, press ENTER in terminal."
  );

  // Wait for user
  await new Promise((resolve) => process.stdin.once("data", resolve));

  // Save cookies
  const cookies = await page.cookies();
  fs.writeFileSync(
    "./Puppeteer/x-cookies.json",
    JSON.stringify(cookies, null, 2)
  );

  console.log("✅ Login successful. Cookies saved to x-cookies.json");

  // Keep Chrome open
  // browser.close(); // <-- do NOT close (user may want to continue)
}

loginX();
