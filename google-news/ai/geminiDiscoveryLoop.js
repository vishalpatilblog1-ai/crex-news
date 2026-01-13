import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

import { judgeNewsContext } from "../../indian-express/ai/judgeNewsContext.js";
import { loadState, saveState } from "../../utils/stateStoreCloud.js";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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
- Official post-match reactions (captain/coach quotes)
- Match-related disciplinary or officiating decisions
- Confirmed last-minute team changes on match day
- Authoritative statements by current or former international players,
  ONLY if:
  - directly related to a match played within the last 24 hours, OR
  - a breaking administrative or disciplinary issue
  AND:
  - presented as a direct quote
  - free of predictions, selection opinions, or hypothetical scenarios
  - sourced from a verified interview or official broadcast.

Evergreen previews, schedules, explainers, or “league ongoing” articles
are NOT news and MUST be rejected.

==================================================
COVERAGE SCOPE (STRICT)
==================================================
- ICC Official News:
  - Rankings updates
  - Playing condition or rules changes
  - Global tournament announcements
  - ICC Men’s and Women’s World Cups (all formats)
  - T20 World Cup 2026 official updates

- International Cricket:
  - All international matches (Men’s and Women’s)
  - Match results, toss updates, and live match status (explicitly stated)
  - Confirmed injury updates
  - Disciplinary or officiating decisions
  - Official post-match reactions from captains, coaches, players, or match officials

- Major International Series & High-Interest Bilaterals:
  - The Ashes (England / Australia)
  - IND vs NZ
  - IND vs AUS
  - IND vs ENG
  - Other globally followed bilateral series
  - Scope limited to match events, confirmed updates, and official statements

- International Milestones & Records:
  - Major individual or team records in international cricket
  - Landmark achievements explicitly stated in the source
  - No inferred significance or retrospective framing

- Global T20 & Franchise Leagues:
  - IPL / PSL / MLC / The Hundred / BBL:
    - Auctions
    - Trades and transfers
    - International player availability or withdrawals
    - Official team announcements
    - Major, verified controversies with authoritative sourcing
  - Focus on players with international relevance or global fan interest

- Women’s Cricket (International & Global Leagues):
  - International matches and tournaments
  - Official squad announcements
  - Confirmed injuries
  - League-level announcements with global relevance (WPL, The Hundred, WBBL)

- ICC Age-Group Events:
  - ICC U19 World Cup:
    - Match results
    - Official squad announcements
    - Breakout performances explicitly highlighted in the source

- Local & Domestic Leagues (STRICTLY LIMITED):
  - Vijay Hazare Trophy (VJT):
    - Knockout-stage matches only
    - Match results, exceptional individual performances, or official announcements
    - Coverage allowed only when explicitly reported by a credible source
  - Other domestic competitions:
    - ONLY when the event has clear international relevance
      (e.g., immediate national call-up, official selector or board reference)
- Authoritative cricket statements:
  - Direct quotes explicitly attributed to former or current international players
        (e.g., Ashwin said, Irfan Pathan said, Nasser Hussain said, Ricky Ponting said)
  - ONLY when:
    - The quote is reported by a credible news source
    - The quote directly reacts to:
      • a match played within the last 24 hours, OR
      • a confirmed injury, selection, disciplinary, or officiating event
    - The quote is factual or declarative in nature
  - NOT allowed:
        - Form explanations
        - Mindset or motivation narratives
        - Retrospective storytelling
        - Hypothetical or opinion-led debates

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

        response_schema: {
          type: "array",
          items: {
            type: "object",
            properties: {
              isNewsworthy: { type: "boolean" },
              newContext: { type: "string" },
              topic: { type: "string" },
              reasoning: { type: "string" },
              sourceUrl: { type: "string" },
              publishedAt: {
                type: "string",
                description:
                  "Full ISO timestamp with minutes, e.g. 2026-01-13T05:22:00Z",
              },
            },
            required: [
              "isNewsworthy",
              "newContext",
              "topic",
              "reasoning",
              "sourceUrl",
              "publishedAt",
            ],
          },
        },
      },
    });

    const rawText = extractGeminiText(response);

    if (!rawText) return null;

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

      const imageSearchQuery = `${decision.topic} ${decision.newContext}`;

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
