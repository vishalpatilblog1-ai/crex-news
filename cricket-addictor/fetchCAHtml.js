import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { setTimeout as delay } from "timers/promises";

const CA_HOME = "https://cricketaddictor.com/cricket-news/";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
];

function pickUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function absolutizeUrl(href) {
  if (!href) return null;
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `https://cricketaddictor.com${href}`;
  return `https://cricketaddictor.com/${href}`;
}

/**
 * Returns: [{ headline, link, publishedAt }]
 */
export async function fetchCAHomeHtml({ limit = 20 } = {}) {
  await delay(Math.floor(Math.random() * 700));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  let res;
  try {
    res = await fetch(CA_HOME, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": pickUA(),
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Upgrade-Insecure-Requests": "1",
      },
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`CA HTML HTTP ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  const candidates = [];

  /* -------------------------------------------------
     Strategy A: Standard <article> blocks
  -------------------------------------------------- */
  $("article").each((_, el) => {
    const $el = $(el);
    const a = $el.find("h1 a, h2 a, h3 a").first();

    const headline = a.text()?.trim();
    const link = absolutizeUrl(a.attr("href"));

    const timeEl = $el.find("time").first();
    const publishedAt =
      timeEl.attr("datetime") || timeEl.text()?.trim() || null;

    // console.log("link::", link);
    if (headline && link) {
      candidates.push({ headline, link, publishedAt });
    }
  });

  /* -------------------------------------------------
     Strategy C: CA homepage card modules (CRITICAL)
  -------------------------------------------------- */
  $(".td_module_wrap, .tdb_module_loop, .td_module_10, .td_module_11").each(
    (_, el) => {
      const $el = $(el);
      const a = $el.find("h3 a, h2 a").first();

      const headline = a.text()?.trim();
      const link = absolutizeUrl(a.attr("href"));

      if (!headline || headline.length < 25) return;
      if (!link || !link.includes("cricketaddictor.com")) return;

      candidates.push({ headline, link, publishedAt: null });
    }
  );

  // console.log("candidates::", candidates);
  /* -------------------------------------------------
     Strategy B: Fallback – prominent anchors
  -------------------------------------------------- */
  if (candidates.length < 5) {
    $("a").each((_, el) => {
      const $a = $(el);
      const text = $a.text()?.trim();
      const href = absolutizeUrl($a.attr("href"));

      if (!text || text.length < 25) return;
      if (!href || !href.includes("cricketaddictor.com")) return;

      if (
        /privacy|terms|about|contact|facebook|twitter|instagram|youtube|whatsapp/i.test(
          text
        )
      ) {
        return;
      }

      candidates.push({ headline: text, link: href, publishedAt: null });
    });
  }

  /* -------------------------------------------------
     Deduplicate by URL
  -------------------------------------------------- */
  const uniq = [];
  const seen = new Set();

  for (const item of candidates) {
    if (seen.has(item.link)) continue;
    seen.add(item.link);
    uniq.push(item);
  }

  /* -------------------------------------------------
     Kill fantasy / prediction spam
  -------------------------------------------------- */
  const filtered = uniq.filter(isPublishableCA);

  return filtered.slice(0, limit);
}

function isPublishableCA(item) {
  const h = item.headline.toLowerCase();
  const u = item.link.toLowerCase();

  if (
    h.includes("dream11") ||
    h.includes("prediction") ||
    h.includes("fantasy") ||
    u.includes("/fantasy-cricket/") ||
    u.includes("/match-prediction")
  ) {
    return false;
  }

  if (h.includes("ipl 2024")) return false;

  return true;
}
