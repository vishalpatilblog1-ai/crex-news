import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fetch from "node-fetch";
// import { saveState } from "../utils/stateStoreCloud.js";

import * as cheerio from "cheerio";
import { judgeNewsContext } from "../../indian-express/ai/judgeNewsContext.js";
import { saveState } from "../../utils/stateStoreCloud.js";

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

export async function geminiDiscoveryLoop() {
  if (!global.STATE) global.STATE = {};
  const STATE = global.STATE;

  if (!STATE.dailyContext) {
    STATE.dailyContext = {
      date: new Date().toISOString().slice(0, 10),
      contexts: [],
    };
  }

  const existingSummaries = STATE.dailyContext.contexts
    .map((c) => c.summary)
    .join(", ");

  console.log("existingSummaries::", existingSummaries);

  const prompt = `
    Identify the most important FACTUAL cricket news published in the last 2 hours.
    
    Limit your analysis strictly to:
    - India National Cricket Team
    - IPL 2026 (teams, players, venues, official decisions)
    - Major international cricket-related controversies or official developments
    
    Do NOT include opinions, speculation, or commentary.
    
    Already covered today:
    ${existingSummaries}
    `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `
            You are a JSON-only response engine.
            
            Strict rules:
            - Respond with VALID JSON only
            - No markdown
            - No prose
            - No explanations
            - No formatting
            - No extra keys
            
            Output schema:
            {
              "isNewsworthy": boolean,
              "newContext": string,
              "topic": string,
              "reasoning": string
            }
            
            If NO qualifying news exists, return:
            {
              "isNewsworthy": false,
              "newContext": "",
              "topic": "",
              "reasoning": ""
            }
            
            TASK:
            ${prompt}
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

    if (!decision || typeof decision.isNewsworthy !== "boolean") {
      console.log("⚠️ Malformed Gemini decision:", decision);
      return;
    }

    let contextDecision = null;

    try {
      contextDecision = await judgeNewsContext({
        articleText: decision.newContext,
        existingContexts: STATE.dailyContext.contexts.map((c) => c.summary),
      });

      if (
        contextDecision?.isAlreadyCovered === true &&
        contextDecision?.confidence >= 0.8
      ) {
        console.log("🔁 Google News context already covered — skipping");
        return;
      }
    } catch (err) {
      console.warn(
        "⚠️ Google News context judge failed, proceeding without dedupe:",
        err.message
      );
    }
    const metadata = response.candidates?.[0]?.groundingMetadata;
    const sources = metadata?.groundingChunks || [];
    const primarySourceUrl = sources[0]?.web?.uri || "";
    const imageUrl = await getOgImage(primarySourceUrl);

    if (decision.isNewsworthy && contextDecision?.newContext) {
      STATE.dailyContext.contexts.push({
        summary: contextDecision.newContext,
        imageUrl,
        createdAt: new Date().toISOString(),
      });

      await saveState(STATE);
    }
    return {
      ...decision,
      imageUrl,
    };
  } catch (err) {
    console.error("Discovery Loop Error:", err);
  }
}
