import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fetch from "node-fetch";

import { loadState } from "../../utils/stateStoreCloud.js";
import { buildDiscoveryPrompt } from "./discoveryPrompt.js";

import {
  dedupeBySource,
  extractArticleText,
  extractGeminiText,
  extractPublishedAt,
  isWithinTimeWindow,
  safeParseGeminiJSON,
  getOgImage,
  resolveFinalUrl,
  normalizePublishedAt,
  // shouldAcceptByTime,
} from "../utils/google-utils.js";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
const DEBUG_FORCE_FIRST_RESULT = false;

function shouldAcceptByTime(publishedAt) {
  if (!publishedAt) return false;

  if (isWithinTimeWindow(publishedAt)) return true;

  return DEBUG_FORCE_FIRST_RESULT;
}

const ALLOWED_DOMAINS = [
  // Indian & subcontinent
  "cricketaddictor.com",
  "indianexpress.com",
  "dawn.com",
  "economictimes.com",
  "ndtv.com",
  "sports.ndtv.com",
  "indiatimes.com",
  "outlookindia.com",
  "india.com",
  "insidesport.in",
  "hindustantimes.com",
  "thehindu.com",
  "news18.com",
  "scroll.in",
  "firstpost.com",
  "espncricinfo.com",
  "cricbuzz.com",
  "bbc.com/sport",
  "reuters.com",
  "deccanherald.com",
];

const NON_ARTICLE_PATTERNS = [
  "/live",
  "/live-score",
  "/commentary",
  "/ball-by-ball",
  "/score",
  "/scorecard",
  "/match",
  "/matches",
  "/points-table",
  "/head-to-head",
];

const UA = {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  },
};

export async function geminiDiscoveryLoop() {
  console.log("geminiDiscoveryLoop...");

  if (!global.STATE) {
    global.STATE = await loadState();
  }

  const discoveryPrompt = buildDiscoveryPrompt({
    nowUtc: new Date().toISOString(),
    windowHours: 1,
  });

  const siteFilter = ALLOWED_DOMAINS.map((s) => `site:${s}`).join(" OR ");

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      systemInstruction: {
        parts: [
          {
            text: `
You are a specialized Cricket News Discovery Agent.

CRITICAL RULES:
- ONLY return cricket-related NEWS articles.
- ONLY use URLs from approved domains.
- ONLY articles published in the last 1 hours.
- NO opinions, previews, live pages, or scorecards.
- Return STRICT JSON array or [].
            `,
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Search using: (${siteFilter}) ${discoveryPrompt}`,
            },
          ],
        },
      ],
      config: {
        tools: [{ googleSearch: {} }],
        response_mime_type: "application/json",
        response_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sourceUrl: { type: "string" },
              publishedAt: { type: "string" },
            },
            required: ["sourceUrl"],
          },
        },
      },
    });

    const rawText = extractGeminiText(response);
    let items = safeParseGeminiJSON(rawText);

    if (!Array.isArray(items) || items.length === 0) {
      console.log("🟡 No new Gemini news to tweet");
      return null;
    }

    items = dedupeBySource(items);

    for (const decision of items) {
      // const finalUrl = decision.sourceUrl;
      // 🔁 Resolve Google / Vertex redirect → real publisher URL
      let finalUrl = await resolveFinalUrl(decision.sourceUrl);

      // Normalize junk commas Gemini sometimes adds
      if (finalUrl) {
        finalUrl = finalUrl.replace(/,+$/, "");
      }

      if (!finalUrl) continue;

      // 1️⃣ Domain allowlist
      // if (!ALLOWED_DOMAINS.some((d) => finalUrl.includes(d))) {
      //   continue;
      // }

      const hostname = new URL(finalUrl).hostname;

      if (
        !ALLOWED_DOMAINS.some(
          (d) => hostname === d || hostname.endsWith(`.${d}`)
        )
      ) {
        continue;
      }

      // 2️⃣ Non-article pages
      const path = new URL(finalUrl).pathname;

      if (NON_ARTICLE_PATTERNS.some((p) => path.startsWith(p))) {
        console.log("⛔ Non-article page detected, skipping:", finalUrl);
        continue;
      }
      // if (NON_ARTICLE_PATTERNS.some((p) => finalUrl.includes(p))) {
      //   console.log("⛔ Non-article page detected, skipping:", finalUrl);
      //   continue;
      // }

      // 3️⃣ Published time validation
      // const publishedAt = await extractPublishedAt(finalUrl);
      // let publishedAt = await extractPublishedAt(finalUrl);
      // publishedAt = normalizePublishedAt(publishedAt);
      // if (!publishedAt || !isWithinTimeWindow(publishedAt)) {
      //   console.log("⏰ Skipping old or invalid news:", finalUrl);
      //   continue;
      // }
      // if (!publishedAt) {
      //   console.log("⛔ No publishedAt, skipping:", finalUrl);
      //   continue;
      // }

      // if (!isWithinTimeWindow(publishedAt)) {
      //   console.log("⚠️ Old news, but allowing for DEBUG:", finalUrl);

      //   if (!DEBUG_FORCE_FIRST_RESULT) {
      //     continue;
      //   }
      // }

      let publishedAt = await extractPublishedAt(finalUrl);
      publishedAt = normalizePublishedAt(publishedAt);

      if (!shouldAcceptByTime(publishedAt)) {
        console.log(
          DEBUG_FORCE_FIRST_RESULT
            ? "⚠️ Old news allowed due to DEBUG:"
            : "⏰ Skipping old or invalid news:",
          finalUrl
        );
        continue;
      }

      // 4️⃣ Fetch article HTML
      const res = await fetch(finalUrl, UA);
      if (!res.ok) {
        console.log("⛔ Failed to fetch article:", res.status, finalUrl);
        continue;
      }

      const html = await res.text();

      // 5️⃣ Extract clean article text
      const articleText = extractArticleText(html, finalUrl);
      // if (!articleText || articleText.length < 1200) {
      //   console.log("⛔ Not a real article, skipping:", finalUrl);
      //   continue;
      // }

      if (!articleText || articleText.length < 400) {
        console.log("⚠️ Short article, but allowing for DEBUG:", finalUrl);

        if (!DEBUG_FORCE_FIRST_RESULT) {
          continue;
        }
      }

      // 6️⃣ Extract OG image
      const imageUrl = await getOgImage(finalUrl);

      if (DEBUG_FORCE_FIRST_RESULT) {
        console.log("🧪 DEBUG MODE: Forcing first valid article through");
      }

      // ✅ Final validated decision
      return {
        sourceUrl: finalUrl,
        publishedAt,
        articleFullText: articleText,
        imageUrl,
      };
    }
  } catch (err) {
    console.error("❌ Gemini discovery error:", err);
  }

  return null;
}
