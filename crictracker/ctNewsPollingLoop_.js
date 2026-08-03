// // crictracker/ctNewsPollingLoop.js

// import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
// import { saveState } from "../utils/stateStoreCloud.js";

// import { isBlockedCAHeadline } from "../cricket-addictor/caHeadlineFilter.js";
// import { isCTArticle, normalizeCTLink } from "./ctFilters.js";
// import { fetchCTRSS } from "./fetchCTRSS.js";
// import { parseCTArticle } from "./parseCTArticle.js";

// import { isRiskyTwitterImage } from "../cricket-addictor/ocr/detectTwitterReference.js";
// import { downloadImageToTemp } from "../cricket-addictor/ocr/downloadImageToTemp.js";
// import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";

// import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
// import {
//   classifyArticle,
//   generateClaudeTweetWithType,
//   SIGNIFICANCE_EXEMPT_TYPES,
// } from "../ai/generateClaudeTweet.js";
// import { getCACTImageUrl } from "../common/getCACTImageUrl.js";

// const MAX_AGE_MIN = 60;
// const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";
// const RETENTION_MS = 6 * 60 * 60 * 1000;

// export async function ctNewsPollingLoop() {
//   console.log("ctNewsPollingLoop..");
//   if (!global.STATE) return false;

//   const STATE = global.STATE;

//   STATE.cricktracker ??= {};
//   STATE.cricktracker.seen ??= {};
//   STATE.dailyContext ??= { contexts: [] };
//   STATE.usedImages ??= {};

//   // ── Prune state ───────────────────────────────────────────────────────────
//   let stateDirty = false;
//   stateDirty ||= pruneCTSeen(STATE, RETENTION_MS);
//   stateDirty ||= pruneDailyContext(STATE, RETENTION_MS);
//   stateDirty ||= pruneUsedImages(STATE, RETENTION_MS);

//   if (stateDirty) {
//     console.log("💾 Persisting pruned CT state");
//     await saveState(STATE);
//   }

//   // ── Fetch RSS ─────────────────────────────────────────────────────────────
//   let items;
//   try {
//     items = await fetchCTRSS();
//   } catch (err) {
//     console.warn("⚠️ CT RSS fetch failed:", err?.message || err);
//     return false;
//   }

//   if (!Array.isArray(items) || items.length === 0) return false;

//   const sorted = items
//     .filter(isCTArticle)
//     .sort((a, b) => getPubDate(b) - getPubDate(a));

//   let selected = null;

//   for (const item of sorted) {
//     const pubMs = getPubDate(item);
//     if (!pubMs) continue;

//     const ageMin = (Date.now() - pubMs) / 60000;
//     if (ageMin > MAX_AGE_MIN) continue;

//     const cleanLink = normalizeCTLink(item.link);
//     if (!cleanLink) continue;

//     if (STATE.cricktracker.seen[cleanLink]) continue;

//     if (isBlockedCAHeadline(item.title)) {
//       STATE.cricktracker.seen[cleanLink] = Date.now();
//       continue;
//     }

//     selected = item;
//     break;
//   }

//   if (!selected) return false;

//   const cleanLink = normalizeCTLink(selected.link);

//   // ── Parse ─────────────────────────────────────────────────────────────────
//   const parsed = parseCTArticle(selected);
//   if (!parsed?.body || parsed.body.length < 80) {
//     STATE.cricktracker.seen[cleanLink] = Date.now();
//     await saveState(STATE);
//     return true;
//   }

//   const fullText = `${parsed.headline}\n${parsed.body} ${JSON.stringify(
//     parsed.table
//   )}`;

//   // ── Step 1: Classify article type first ──────────────────────────────────
//   let articleType = "player_form";
//   try {
//     articleType = await classifyArticle(fullText);
//     // console.log(`🏷️ Classified as: ${articleType}`);
//   } catch (err) {
//     console.warn("⚠️ classifyArticle failed, using default:", err?.message);
//   }

//   // ── Step 2: Deduplication + significance gate ─────────────────────────────
//   let decision = null;
//   try {
//     decision = await judgeNewsContext({
//       articleText: fullText,
//       existingContexts:
//         STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
//     });

//     if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
//       console.log("🔴 CT skipped — already covered context");
//       STATE.cricktracker.seen[cleanLink] = Date.now();
//       await saveState(STATE);
//       return true;
//     }

//     const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
//     const score = decision?.significanceScore ?? 10;
//     // if (!isExempt) {
//     if (!isExempt && score < 7) {
//       console.log(
//         `⬇️ Low significance (${score}/10) — skipping: ${parsed.headline}`
//       );
//       STATE.cricktracker.seen[cleanLink] = Date.now();
//       await saveState(STATE);
//       return true;
//     }

//     if (isExempt) {
//       console.log(
//         `🌟 Exempt type (${articleType}) — bypassing significance gate (score: ${score}/10)`
//       );
//     } else {
//       console.log(`✅ Significance: ${score}/10 — proceeding`);
//     }
//   } catch (err) {
//     console.warn("⚠️ CT judgeNewsContext failed:", err?.message || err);
//   }

//   // ── Step 3: Tweet generation ──────────────────────────────────────────────
//   const imageUrl = getCACTImageUrl(selected);
//   const { useImage } = await decideImageUsage({
//     imageUrl,
//     usedImages: STATE.usedImages,
//   });

//   let tweetText = null;
//   try {
//     const result = await generateClaudeTweetWithType(fullText, articleType);
//     tweetText = result.tweetText;
//     console.log("Prompt generated by claude ....");
//   } catch (err) {
//     console.warn("⚠️ Claude failed:", err?.message || err);
//   }

//   if (!tweetText || tweetText.trim().length < 30) {
//     try {
//       tweetText = await generateGeminiTweet(fullText);
//       console.log("Prompt generated by Gemini ....");
//     } catch (err) {
//       console.warn("⚠️ Gemini failed:", err?.message || err);
//     }
//   }

//   if (!tweetText || tweetText.length < 30) {
//     STATE.cricktracker.seen[cleanLink] = Date.now();
//     await saveState(STATE);
//     return true;
//   }

//   // ── Enqueue ───────────────────────────────────────────────────────────────
//   tweetText = applySourceSignature(tweetText, "CT");

//   const tweetId = `CT:${cleanLink}`;

//   enqueueTweet({
//     id: tweetId,
//     source: "CT",
//     text: tweetText,
//     imageUrl: useImage ? imageUrl : null,
//     seenKey: cleanLink,
//   });

//   console.log(`📥 Queued CT tweet: ${parsed.headline}`);

//   if (useImage && imageUrl) {
//     STATE.usedImages[imageUrl] = Date.now();
//   }

//   STATE.cricktracker.seen[cleanLink] = Date.now();

//   if (decision?.newContext && !contextExists(STATE, decision.newContext)) {
//     STATE.dailyContext.contexts.push({
//       summary: decision.newContext,
//       source: "CT",
//       link: cleanLink,
//       createdAt: new Date().toISOString(),
//     });
//   }

//   await saveState(STATE);
//   return true;
// }

// // ── Helpers ────────────────────────────────────────────────────────────────

// function getPubDate(item) {
//   return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
// }

// function pruneCTSeen(STATE, retentionMs) {
//   try {
//     const now = Date.now();
//     let pruned = 0;

//     for (const [link, ts] of Object.entries(STATE.cricktracker?.seen || {})) {
//       if (now - ts > retentionMs) {
//         delete STATE.cricktracker.seen[link];
//         pruned++;
//       }
//     }

//     if (pruned > 0) {
//       console.log(`🧹 Pruned ${pruned} old CT seen entries`);
//       return true;
//     }
//   } catch (err) {
//     console.warn("⚠️ CT seen prune failed:", err?.message || err);
//   }
//   return false;
// }

// function pruneDailyContext(STATE, retentionMs) {
//   try {
//     const ctx = STATE.dailyContext?.contexts;
//     if (!Array.isArray(ctx) || ctx.length === 0) return false;

//     const now = Date.now();
//     const before = ctx.length;

//     STATE.dailyContext.contexts = ctx.filter((c) => {
//       const t = new Date(c.createdAt).getTime();
//       return Number.isFinite(t) && now - t <= retentionMs;
//     });

//     if (before !== STATE.dailyContext.contexts.length) {
//       console.log(
//         `🧹 Pruned ${
//           before - STATE.dailyContext.contexts.length
//         } old dailyContext entries`
//       );
//       return true;
//     }
//   } catch (err) {
//     console.warn("⚠️ CT dailyContext prune failed:", err?.message || err);
//   }
//   return false;
// }

// function pruneUsedImages(STATE, retentionMs) {
//   try {
//     const now = Date.now();
//     let pruned = 0;

//     for (const [imgUrl, ts] of Object.entries(STATE.usedImages || {})) {
//       if (now - ts > retentionMs) {
//         delete STATE.usedImages[imgUrl];
//         pruned++;
//       }
//     }

//     if (pruned > 0) {
//       console.log(`🧹 Pruned ${pruned} old usedImages entries`);
//       return true;
//     }
//   } catch (err) {
//     console.warn("⚠️ CT usedImages prune failed:", err?.message || err);
//   }
//   return false;
// }

// async function decideImageUsage({ imageUrl, usedImages }) {
//   if (!imageUrl)
//     return { useImage: false, reason: "🖼️ No imageUrl — text-only" };

//   if (usedImages?.[imageUrl]) {
//     return {
//       useImage: false,
//       reason: "🖼️ Image already used — forcing text-only",
//     };
//   }

//   try {
//     const localImagePath = await downloadImageToTemp(imageUrl);
//     const ocrResult = await isRiskyTwitterImage(localImagePath);

//     if (!ocrResult?.risky) return { useImage: true, reason: "" };

//     return {
//       useImage: false,
//       reason: `⚠️ OCR flagged image as risky: ${ocrResult.reason || "unknown"}`,
//     };
//   } catch (err) {
//     return {
//       useImage: false,
//       reason: `⚠️ OCR check failed, fallback to text-only: ${
//         err?.message || err
//       }`,
//     };
//   }
// }

// function contextExists(STATE, summary) {
//   if (!STATE.dailyContext?.contexts?.length) return false;
//   const norm = normalizeSummary(summary);
//   return STATE.dailyContext.contexts.some(
//     (c) => normalizeSummary(c.summary) === norm
//   );
// }

// function normalizeSummary(text = "") {
//   return text
//     .toLowerCase()
//     .replace(/[^a-z0-9 ]/g, "")
//     .replace(/\s+/g, " ")
//     .trim();
// }
