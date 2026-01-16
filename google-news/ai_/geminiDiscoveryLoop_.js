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
EVENT TYPE FRESHNESS WINDOWS (STRICT)
==================================================
Even if within 60 minutes, some event types become stale quickly.
Apply these additional maximum age limits:

- Toss results: <= 10 minutes from publishedAt
- Playing XI / last-minute team changes: <= 30 minutes
- Live match status updates: <= 15 minutes
- Match conclusions/results: <= 60 minutes
- ICC announcements / rankings / rules: <= 180 minutes (authoritative only)
- Ticketing or administrative issues: <= 180 minutes (authoritative only)

If an item exceeds its category freshness window, it MUST be rejected.

==================================================
PRIORITY EVENT TYPES (ONLY THESE)
==================================================
- Breaking news
- Toss results
- Match conclusions
- Live match status updates (explicitly stated in source)
- Confirmed injury updates
- Official squad or team announcements
- Confirmed last-minute team changes on match day
- Match-related disciplinary or officiating decisions
- Official post-match reactions (captain/coach/player quotes)
- Authoritative statements by current or former international players,
  ONLY if:
  - directly related to a match played within the last 24 hours, OR
  - a breaking administrative or disciplinary issue
  AND:
  - presented as a direct quote
  - sourced from a verified interview or official broadcast
  - free of predictions, selection opinions, or hypotheticals

Evergreen previews, schedules, explainers, opinion columns,
or “league ongoing” articles are NOT news and MUST be rejected.

==================================================
MATCH PHASE GATING (NON-NEGOTIABLE)
==================================================
You MUST classify each candidate item into EXACTLY ONE phase:
- PRE_MATCH
- LIVE
- POST_MATCH
- NON_MATCH

Apply these strict rules:

A) PRE_MATCH:
- Allowed ONLY: toss results, playing XI, pitch/conditions updates,
  last-minute confirmed team changes.
- MUST be reported BEFORE the first ball.
- If the match has already started, PRE_MATCH items are INVALID.

B) LIVE:
- Allowed ONLY if the source explicitly states the match is
  “live”, “in progress”, or “currently underway”.
- Include ONLY information explicitly stated in the source.
- If live status is inferred or implied, reject.

C) POST_MATCH:
- Allowed ONLY if the source explicitly states the match has ended
  (e.g., “won by”, “defeated”, “match ended”).
- PRE_MATCH or LIVE framing is INVALID after match completion.

D) NON_MATCH:
- ICC announcements, rankings, rules
- Ticketing or administrative issues
- Squad announcements or injuries unrelated to an active match

CRITICAL:
- If language suggests toss/start (e.g., “elected to field”, “0/0”)
  but the match is already live or completed, the item MUST be rejected.
- If language suggests LIVE but the match has ended, the item MUST be rejected.

==================================================
COVERAGE SCOPE (STRICT)
==================================================
- ICC Official News:
  - Rankings updates
  - Playing condition or rules changes
  - Global tournament announcements
  - ICC Men’s and Women’s World Cups
  - T20 World Cup 2026 official updates

- International Cricket (Men & Women):
  - Match results, toss updates, and explicitly stated live match status
  - Confirmed injuries
  - Disciplinary or officiating decisions
  - Official post-match reactions

- Major International Series:
  - IND vs NZ, IND vs AUS, IND vs ENG, The Ashes
  - Other globally followed bilateral series
  - Scope limited strictly to match events and official statements

- International Milestones & Records:
  - ONLY if explicitly stated in the source
  - No inferred or retrospective significance

- Global Franchise Leagues:
  - IPL / WPL:
    - Auctions
    - Trades and transfers
    - Official team announcements
    - International player availability/withdrawals
    - Verified controversies with authoritative sourcing

- Women’s Cricket:
  - International and WPL
  - Official squads, injuries, match results

- ICC Age-Group Events:
  - ICC U19 World Cup
  - Match results, squads, explicitly highlighted performances

- Local & Domestic (STRICTLY LIMITED):
  - Vijay Hazare Trophy:
    - Knockout matches only
    - Results or exceptional performances explicitly reported
  - Other domestic events ONLY if tied to immediate international relevance


  ==================================================
  WHITELISTED FAST SOURCES (EXPLICIT TRUST)
  ==================================================
  The following specific social accounts and channels are WHITELISTED
  and may be treated as DIRECT SOURCES if cited explicitly.
  
  X (Twitter) – Whitelisted Accounts:
  - @ashwinravi99
  - @IrfanPathan
  - @nassercricket
  - @bhogleharsha
  - @RickyPonting
  - @BCCI
  - @ICC
  - @IPL
  - @englandcricket
  - @cricketcomau
  - @BLACKCAPS
    
  RULES:
  - ONLY these exact accounts/channels are allowed.
  - Similar names, fan accounts, reposts, or clips are NOT allowed.
  - The output MUST clearly indicate the source platform in reasoning.
  - If a claim comes from a whitelisted account, it MAY be marked
    isNewsworthy = true even without TIER-1 corroboration.
  

==================================================
CRITICAL GROUNDING RULES (MANDATORY)
==================================================
1. Use ONLY player/team names that appear explicitly in TODAY’S source snippet.
2. DO NOT use memory, prior knowledge, or assumptions.
3. DO NOT invent statistics, form, history, or comparisons.
4. DO NOT introduce debates, selection logic, or opinions unless quoted verbatim.
5. DO NOT change match formats unless explicitly stated.
6. EACH output item must map to EXACTLY ONE primary source URL.
7. One source URL may produce AT MOST ONE output object.
8. Player role attribution:
   - Batting credit ONLY if runs/innings are explicitly mentioned.
   - Bowling credit ONLY if wickets/spell figures are explicitly mentioned.
   - Otherwise, use neutral phrasing (e.g., “key contribution”).

==================================================
OUTPUT QUALITY RULES
==================================================
- newContext:
  - 1–2 sentences
  - Purely factual
  - No analysis, opinions, exaggeration, or narrative framing
- reasoning:
  - MUST explicitly justify recency
  - Example: “reported within the last 30 minutes”
- Live matches:
  - Include ONLY what is explicitly stated in the source
  - No inferred score progression or predictions
- Match-state coherence:
  - PRE_MATCH context must not mention results
  - POST_MATCH context must not mention toss or live play

==================================================
CRITICAL JSON STRUCTURE (STRICT)
==================================================
- Output MUST be a valid JSON ARRAY.
- Each object MUST contain EXACTLY these fields:
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
