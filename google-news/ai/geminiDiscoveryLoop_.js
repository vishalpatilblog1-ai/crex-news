// import { GoogleGenAI } from "@google/genai";
// import dotenv from "dotenv";
// import fetch from "node-fetch";
// import * as cheerio from "cheerio";

// import { judgeNewsContext } from "../../indian-express/ai/judgeNewsContext.js";
// import { loadState, saveState } from "../../utils/stateStoreCloud.js";
// import { buildDiscoveryPrompt } from "./discoveryPrompt.js";

// dotenv.config();

// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

// function stripCodeFences(text) {
//   return text
//     .replace(/^```json\s*/i, "")
//     .replace(/^```\s*/i, "")
//     .replace(/\s*```$/i, "")
//     .trim();
// }

// function extractGeminiText(response) {
//   if (typeof response.text === "string" && response.text.trim()) {
//     return response.text;
//   }

//   return response.candidates?.[0]?.content?.parts
//     ?.map((p) => p.text)
//     ?.join("")
//     ?.trim();
// }

// async function getOgImage(articleUrl) {
//   if (!articleUrl) return null;

//   try {
//     const res = await fetch(articleUrl, { redirect: "follow" });
//     const html = await res.text();
//     const $ = cheerio.load(html);

//     return (
//       $('meta[property="og:image"]').attr("content") ||
//       $('meta[name="twitter:image"]').attr("content") ||
//       null
//     );
//   } catch {
//     return null;
//   }
// }

// function dedupeBySource(items) {
//   const seen = new Set();
//   return items.filter((item) => {
//     if (seen.has(item.sourceUrl)) return false;
//     seen.add(item.sourceUrl);
//     return true;
//   });
// }

// const MAX_AGE_MINUTES = 60;

// function isWithinTimeWindow(publishedAt) {
//   if (!publishedAt) return false;

//   const publishedTime = new Date(publishedAt).getTime();
//   if (Number.isNaN(publishedTime)) return false;

//   const now = Date.now();
//   const diffMs = now - publishedTime;

//   if (diffMs < 0) return false;

//   return diffMs <= MAX_AGE_MINUTES * 60 * 1000;
// }

// export async function geminiDiscoveryLoop() {
//   if (!global.STATE) {
//     global.STATE = await loadState();
//   }

//   const STATE = global.STATE;

//   const NOW = Date.now();
//   const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

//   // Ensure dailyContext exists and is valid
//   if (!STATE.dailyContext || !Array.isArray(STATE.dailyContext.contexts)) {
//     STATE.dailyContext = { contexts: [] };
//   }

//   // ⛏️ Prune contexts older than 24 hours
//   STATE.dailyContext.contexts = STATE.dailyContext.contexts.filter((c) => {
//     if (!c.createdAt) return false;
//     const age = NOW - new Date(c.createdAt).getTime();
//     return age >= 0 && age <= TTL_MS;
//   });

//   const existingContexts = STATE.dailyContext.contexts.map((c) => c.summary);

//   const discoveryPrompt = buildDiscoveryPrompt({
//     nowUtc: new Date().toISOString(),
//   });

//   try {
//     const response = await ai.models.generateContent({
//       model: "gemini-2.0-flash",
//       contents: [
//         {
//           role: "user",
//           parts: [{ text: discoveryPrompt }],
//         },
//       ],
//       config: {
//         tools: [{ googleSearch: {} }],
//         response_mime_type: "application/json",

//         response_schema: {
//           type: "array",
//           items: {
//             type: "object",
//             properties: {
//               isNewsworthy: { type: "boolean" },
//               newContext: { type: "string" },
//               topic: { type: "string" },
//               reasoning: { type: "string" },
//               sourceUrl: { type: "string" },
//               publishedAt: {
//                 type: "string",
//                 description:
//                   "Full ISO timestamp with minutes, e.g. 2026-01-13T05:22:00Z",
//               },
//             },
//             required: [
//               "isNewsworthy",
//               "newContext",
//               "topic",
//               "reasoning",
//               "sourceUrl",
//               "publishedAt",
//             ],
//           },
//         },
//       },
//     });

//     const rawText = extractGeminiText(response);

//     if (!rawText) return null;

//     let items;
//     try {
//       items = JSON.parse(stripCodeFences(rawText));
//     } catch (e) {
//       console.error("❌ Failed to parse Gemini JSON", e);
//       return null;
//     }

//     if (!Array.isArray(items) || items.length === 0) return null;

//     items = dedupeBySource(items);

//     items = items.map((item) => {
//       const withinTime = isWithinTimeWindow(item.publishedAt);

//       console.log("withinTime:::", withinTime, item.isNewsworthy);

//       return {
//         ...item,
//         isNewsworthy: withinTime && item.isNewsworthy === true,
//       };
//     });

//     items = items.filter((item) => item.isNewsworthy === true);

//     if (items.length === 0) {
//       console.log("🟡 No new Gemini news to tweet");
//       return null;
//     }

//     // console.log("🔍 CLEANED GEMINI OUTPUT:\n", items);

//     for (const decision of items) {
//       const { newContext, topic, reasoning } = decision;
//       if (decision.isNewsworthy !== true) continue;

//       const contextDecision = await judgeNewsContext({
//         articleText: newContext + " " + topic + " " + reasoning,
//         existingContexts,
//       });

//       if (
//         contextDecision?.isAlreadyCovered &&
//         contextDecision?.confidence >= 0.8
//       ) {
//         continue;
//       }

//       const imageSearchQuery = `${decision.topic} ${decision.newContext}`;

//       const imageResponse = await ai.models.generateContent({
//         model: "gemini-2.0-flash",
//         contents: [
//           {
//             role: "user",
//             parts: [
//               { text: `Find a relevant news image for: ${imageSearchQuery}` },
//             ],
//           },
//         ],
//         config: {
//           tools: [{ googleSearch: {} }],
//         },
//       });

//       const imgMetadata =
//         imageResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

//       const primarySourceUrl =
//         imgMetadata.find((c) => c.web?.uri)?.web?.uri || null;

//       let imageUrl = await getOgImage(primarySourceUrl);

//       STATE.dailyContext.contexts.push({
//         summary: contextDecision?.newContext || decision.newContext,
//         imageUrl,
//         sourceUrl: primarySourceUrl,
//         createdAt: new Date().toISOString(),
//       });

//       await saveState(STATE);

//       return { ...decision, sourceUrl: primarySourceUrl, imageUrl };
//     }
//   } catch (err) {
//     console.error("❌ Gemini discovery error:", err);
//   }
// }
