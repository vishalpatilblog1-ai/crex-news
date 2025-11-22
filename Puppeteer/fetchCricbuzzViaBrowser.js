// Puppeteer/fetchCricbuzzViaBrowser.js
import { getPage } from "./browser.js";

export async function fetchScorecard(matchId) {
  const url = `https://m.cricbuzz.com/api/cricket-match/scorecard/${matchId}`;
  return await loadJsonViaGoto(url);
}

export async function fetchCommentary(matchId) {
  const url = `https://m.cricbuzz.com/api/cricket-match/commentary/${matchId}`;
  return await loadJsonViaGoto(url);
}

async function loadJsonViaGoto(url) {
  const page = getPage();
  if (!page) return { error: "NO_PAGE" };

  try {
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 20000,
    });

    const preText = await page.evaluate(() => {
      const pre = document.querySelector("pre");
      return pre ? pre.textContent : null;
    });

    if (!preText) {
      return { error: "NO_PRE_TAG", html: await page.content().slice(0, 200) };
    }

    try {
      return JSON.parse(preText);
    } catch (e) {
      return { error: "JSON_PARSE_FAILED", raw: preText.slice(0, 200) };
    }
  } catch (e) {
    return { error: "GOTO_FAILED", message: e.message };
  }
}
