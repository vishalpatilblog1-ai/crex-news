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

export async function geminiDiscoveryLoop() {
  /* 🔑 CRITICAL: hydrate state ONCE */
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

  // 🛡️ SECOND GUARD — this is the missing one
  if (!Array.isArray(STATE.dailyContext.contexts)) {
    STATE.dailyContext.contexts = [];
  }

  const existingContexts = STATE.dailyContext.contexts.map((c) => c.summary);

  const existingSummaries = existingContexts.join(", ");

  const discoveryPrompt = `
IMPORTANT:
- Identify ONLY ONE news event.
- Do NOT combine multiple unrelated developments.
- If multiple important events exist, return ONLY the most impactful ONE.
- Never merge two stories into a single summary.

Strictly limit scope to:
- India National Cricket Team
- IPL 2026 (teams, players, venues, official decisions)
- Major international cricket-related controversies or official developments

Do NOT include:
- Opinions
- Speculation
- Predictions
- Commentary

Already covered today:
${existingSummaries}
`;

  try {
    /* -------------------- Gemini Call -------------------- */

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
You are a JSON-only response engine.

Rules:
- Output VALID JSON only
- No markdown
- No prose
- No explanations
- No extra keys

Schema:
{
  "isNewsworthy": boolean,
  "newContext": string,
  "topic": string,
  "reasoning": string
}

If no qualifying news exists:
{
  "isNewsworthy": false,
  "newContext": "",
  "topic": "",
  "reasoning": ""
}

TASK:
${discoveryPrompt}
`,
            },
          ],
        },
      ],
      config: {
        tools: [{ googleSearch: {} }],
        response_mime_type: "application/json",
        response_schema: {
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
    });

    /* -------------------- Parse Gemini Output -------------------- */

    const rawText = extractGeminiText(response);
    if (!rawText) {
      console.log("⚠️ Empty Gemini response");
      return;
    }

    let decision;
    try {
      decision = JSON.parse(stripCodeFences(rawText));
    } catch {
      console.error("❌ Invalid JSON from Gemini:\n", rawText);
      return;
    }

    if (!decision || decision.isNewsworthy !== true) {
      console.log("ℹ️ No newsworthy Gemini item");
      return null;
    }

    /* -------------------- Context Deduplication -------------------- */

    let contextDecision;

    try {
      contextDecision = await judgeNewsContext({
        articleText: decision.newContext,
        existingContexts,
      });

      if (
        contextDecision?.isAlreadyCovered === true &&
        contextDecision?.confidence >= 0.8
      ) {
        console.log("🔁 Gemini context already covered — skipping");
        return null;
      }
    } catch (err) {
      console.warn("⚠️ Context judge failed, continuing:", err.message);
    }

    /* -------------------- Image Extraction -------------------- */

    const metadata = response.candidates?.[0]?.groundingMetadata;

    const sources = metadata?.groundingChunks || [];
    const primarySourceUrl = sources[0]?.web?.uri || null;

    const imageUrl = await getOgImage(primarySourceUrl);

    /* -------------------- Save State -------------------- */

    STATE.dailyContext.contexts.push({
      summary: contextDecision?.newContext || decision.newContext,
      imageUrl,
      createdAt: new Date().toISOString(),
    });

    await saveState(STATE);
    console.log("💾 Gemini dailyContext saved");

    /* -------------------- Return -------------------- */

    return {
      ...decision,
      imageUrl,
    };
  } catch (err) {
    console.error("❌ Gemini discovery error:", err);
  }
}
