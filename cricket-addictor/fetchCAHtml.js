import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { setTimeout as delay } from "timers/promises";

const CA_HOME = "https://cricketaddictor.com/";

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
 * Returns: [{ headline, link, publishedAt? }]
 */
export async function fetchCAHomeHtml({ limit = 20 } = {}) {
  // small jitter
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
        // these sometimes help with CDNs:
        "Upgrade-Insecure-Requests": "1",
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    throw new Error(
      `CA HTML network error: ${err?.name || ""} ${err?.message || err}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`CA HTML HTTP ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // CA layout changes over time; we implement a "multi-selector" strategy.
  const candidates = [];

  // Strategy A: common WP patterns - article cards with h2/h3 titles
  $("article").each((_, el) => {
    const $el = $(el);
    const a = $el.find("h1 a, h2 a, h3 a").first();

    const headline = a.text()?.trim();
    const link = absolutizeUrl(a.attr("href"));

    // optional time (best effort)
    const timeEl = $el.find("time").first();
    const publishedAt =
      timeEl.attr("datetime") || timeEl.text()?.trim() || null;

    if (headline && link) {
      candidates.push({ headline, link, publishedAt });
    }
  });

  // Strategy B: fallback – scan any prominent title anchors
  if (candidates.length < 5) {
    $("a").each((_, el) => {
      const $a = $(el);
      const text = $a.text()?.trim();
      const href = absolutizeUrl($a.attr("href"));

      if (!text || text.length < 25) return;
      if (!href || !href.includes("cricketaddictor.com")) return;

      // avoid nav/footer junk
      const bad =
        /privacy|terms|about|contact|facebook|twitter|instagram|youtube|whatsapp/i.test(
          text
        );
      if (bad) return;

      candidates.push({ headline: text, link: href, publishedAt: null });
    });
  }

  // Deduplicate by link
  const uniq = [];
  const seen = new Set();
  for (const item of candidates) {
    if (seen.has(item.link)) continue;
    seen.add(item.link);
    uniq.push(item);
  }

  // Keep only actual article URLs (basic filter)
  //   const filtered = uniq.filter((x) => {
  //     // many WP posts have date or slug; keep it loose
  //     return /cricketaddictor\.com\/.+/.test(x.link) && x.headline.length >= 25;
  //   });

  const filtered = uniq.filter(isPublishableCA);

  return filtered.slice(0, limit);
}

function isPublishableCA(item) {
  const h = item.headline.toLowerCase();
  const u = item.link.toLowerCase();

  // kill fantasy & prediction content
  if (
    h.includes("dream11") ||
    h.includes("prediction") ||
    h.includes("fantasy") ||
    u.includes("/fantasy-cricket/") ||
    u.includes("/match-prediction")
  ) {
    return false;
  }

  // optional: skip very old IPL stuff
  if (h.includes("ipl 2024")) return false;

  return true;
}
