import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

import { judgeNewsContext } from "../../indian-express/ai/judgeNewsContext.js";
import { loadState, saveState } from "../../utils/stateStoreCloud.js";

dotenv.config();

/* -------------------- Gemini Client -------------------- */

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/* -------------------- Helpers -------------------- */

function stripCodeFences(text) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractGeminiText(response) {
  if (typeof response.text === "string" && response.text.trim()) {
    return response.text;
  }

  return response.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    ?.join("")
    ?.trim();
}

async function getOgImage(articleUrl) {
  if (!articleUrl) return null;

  try {
    const res = await fetch(articleUrl, { redirect: "follow" });
    const html = await res.text();
    const $ = cheerio.load(html);

    return (
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      null
    );
  } catch {
    return null;
  }
}

/* -------------------- Main Loop -------------------- */

function dedupeBySource(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.sourceUrl)) return false;
    seen.add(item.sourceUrl);
    return true;
  });
}

const MAX_AGE_MINUTES = 60;

function isWithinTimeWindow(publishedAt) {
  if (!publishedAt) return false;

  const publishedTime = new Date(publishedAt).getTime();
  if (Number.isNaN(publishedTime)) return false;

  const now = Date.now();
  const diffMs = now - publishedTime;

  // Reject future timestamps or old ones
  if (diffMs < 0) return false;

  return diffMs <= MAX_AGE_MINUTES * 60 * 1000;
}

export async function geminiDiscoveryLoop() {
  if (!global.STATE || !global.STATE.dailyContext) {
    global.STATE = await loadState();
  }

  const STATE = global.STATE;

  if (
    !STATE.dailyContext ||
    STATE.dailyContext.date !== new Date().toISOString().slice(0, 10)
  ) {
    STATE.dailyContext = {
      date: new Date().toISOString().slice(0, 10),
      contexts: [],
    };
  }

  if (!Array.isArray(STATE.dailyContext.contexts)) {
    STATE.dailyContext.contexts = [];
  }

  const existingContexts = STATE.dailyContext.contexts.map((c) => c.summary);

  const discoveryPrompt = `
IDENTITY:
You are a real-time sports news discovery engine.

CURRENT TIME (UTC):
${new Date().toISOString()}

==================================================
STRICT TEMPORAL SCOPE (NON-NEGOTIABLE)
==================================================
- You MUST consider ONLY events reported in the LAST 15–60 MINUTES.
- Any event older than 60 minutes is INVALID, regardless of importance.
- If exact publish time cannot be determined with minute-level precision,
  the item MUST be rejected.

HARD TIME FILTER (OVERRIDES ALL OTHER RULES):
- Compute the time difference between Current Time (UTC) and publishedAt.
- If publishedAt is MORE THAN 60 MINUTES older than Current Time (UTC),
  you MUST set isNewsworthy = false.
- If publishedAt is missing, vague, date-only, or unverifiable,
  you MUST set isNewsworthy = false.
- Do NOT rely on assumptions, summaries, or “recently reported” phrasing.

==================================================
PRIORITY EVENT TYPES (ONLY THESE)
==================================================
- Breaking news
- Toss results
- Match conclusions
- Live match status updates (explicitly stated in source)
- Confirmed injury updates
- Official squad or team announcements

Evergreen previews, schedules, explainers, or “league ongoing” articles
are NOT news and MUST be rejected.

==================================================
COVERAGE SCOPE (STRICT)
==================================================
- India Men's National Team (international matches & official selections only)
- IPL (auctions, trades, official team announcements only)
- WPL (live matches & confirmed injury updates only)
- Domestic Cricket:
  - Vijay Hazare Trophy — knockout matches only
  - Ranji Trophy — knockout matches only

==================================================
CRITICAL GROUNDING RULES (MANDATORY)
==================================================
1. Use ONLY player/team names that appear explicitly in TODAY’S source snippet.
2. DO NOT use memory, prior knowledge, or assumptions.
3. DO NOT invent statistics, form, history, or comparisons.
4. DO NOT introduce debates or implied selection logic unless stated verbatim.
5. DO NOT change match formats unless explicitly mentioned in the source.
6. EACH output item must map to EXACTLY ONE primary web source.
7. One primary source URL may produce AT MOST ONE output object. Multiple summaries from the same source are forbidden.

==================================================
OUTPUT QUALITY RULES
==================================================
- newContext:
  - 1–2 sentences
  - Purely factual
  - No analysis, opinions, or exaggeration
- reasoning:
  - MUST explicitly justify recency
  - Example: “reported within the last hour” or “match currently in progress”
  - If recency cannot be proven, set isNewsworthy = false
- Live matches:
  - Include ONLY what is explicitly stated in the source snippet
  - No ball-by-ball or inferred updates

==================================================
CRITICAL JSON STRUCTURE (STRICT)
==================================================
- Output MUST be a valid JSON ARRAY.
- Each object MUST use EXACT field names:
  - isNewsworthy (boolean)
  - newContext (string)
  - topic (string)
  - reasoning (string)
  - sourceUrl (string)
  - publishedAt (string, full ISO timestamp required)

- If NO valid news exists within the last 60 minutes,
  return EXACTLY this object and nothing else:

[
  {
    "isNewsworthy": false,
    "newContext": "",
    "topic": "",
    "reasoning": "",
    "sourceUrl": "",
    "publishedAt": ""
  }
]

==================================================
OUTPUT RULES (ABSOLUTE)
==================================================
- Return ONLY raw JSON.
- NO markdown.
- NO explanations.
- NO extra text.
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [{ text: discoveryPrompt }],
        },
      ],
      config: {
        tools: [{ googleSearch: {} }],
        response_mime_type: "application/json",

        // 🔴 FIX 1: ARRAY schema (correct)
        response_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              isNewsworthy: { type: "boolean" },
              newContext: { type: "string" },
              topic: { type: "string" },
              reasoning: { type: "string" },
            },
            required: ["isNewsworthy", "newContext", "topic", "reasoning"],
          },
        },
      },
    });

    const rawText = extractGeminiText(response);

    if (!rawText) return null;
    // console.log("🔍 RAW GEMINI OUTPUT:\n", rawText);

    let items;
    try {
      items = JSON.parse(stripCodeFences(rawText));
    } catch (e) {
      console.error("❌ Failed to parse Gemini JSON", e);
      return null;
    }

    if (!Array.isArray(items) || items.length === 0) return null;

    items = dedupeBySource(items);

    items = items.map((item) => {
      const withinTime = isWithinTimeWindow(item.publishedAt);

      console.log("withinTime:::", withinTime, item.isNewsworthy);

      return {
        ...item,
        isNewsworthy: withinTime && item.isNewsworthy === true,
      };
    });

    items = items.filter((item) => item.isNewsworthy === true);

    if (items.length === 0) {
      console.log("🟡 No new Gemini news to tweet");
      return null;
    }

    console.log("🔍 CLEANED GEMINI OUTPUT:\n", items);

    for (const decision of items) {
      const { newContext, topic, reasoning } = decision;
      if (decision.isNewsworthy !== true) continue;

      const contextDecision = await judgeNewsContext({
        articleText: newContext + " " + topic + " " + reasoning,
        existingContexts,
      });

      if (
        contextDecision?.isAlreadyCovered &&
        contextDecision?.confidence >= 0.8
      ) {
        continue;
      }

      if (!contextDecision?.isAlreadyCovered) {
        console.log("chosen context:::", contextDecision);
      }

      const imageSearchQuery = `${decision.topic} ${decision.newContext}`;

      // Use Google Search tool AGAIN for this decision
      const imageResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: `Find a relevant news image for: ${imageSearchQuery}` },
            ],
          },
        ],
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const imgMetadata =
        imageResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      const primarySourceUrl =
        imgMetadata.find((c) => c.web?.uri)?.web?.uri || null;
      let imageUrl = await getOgImage(primarySourceUrl);

      // console.log("primarySourceUrl::", primarySourceUrl);
      console.log("imageUrl::", imageUrl);

      STATE.dailyContext.contexts.push({
        summary: contextDecision?.newContext || decision.newContext,
        imageUrl,
        sourceUrl: primarySourceUrl,
        createdAt: new Date().toISOString(),
      });

      await saveState(STATE);

      return { ...decision, sourceUrl: primarySourceUrl, imageUrl };
    }
  } catch (err) {
    console.error("❌ Gemini discovery error:", err);
  }
}
