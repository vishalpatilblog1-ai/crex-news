// ndtvnewsPollingLoop.js

import {
  classifyArticle,
  generateGPTTweetWithType,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generate-gpt-tweet.js";
import { generateGeminiTweet } from "../ai/generate-gemini-tweet.js";
import { generateCardImage } from "../canvas/imageRenderer.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import { applySourceSignature, enqueueTweet } from "../twitter/tweetQueue.js";
import { CREX_BASE_IMAGE_TEMPLATE } from "../utils/config.js";
import { saveState } from "../utils/stateStoreCloud.js";

import { fetchNDTVArticle } from "./fetchNDTVArticle.js";
import { isNDTVArticle, normalizeNDTVLink } from "./isNDTVArticle.js";
import { fetchNDTVCricketRSS } from "./ndtvRssFetcher.js";
import { parseNDTVArticle } from "./parseNDTVArticle.js";

// NOTE: this file assumes a blocked-pattern headline/body filter equivalent
// to CA's isBlockedCAHeadline exists (or should exist) for NDTV. CA's own
// filter lives at cricket-addictor/caHeadlineFilter.js and is CA-specific in
// name -- confirm whether it's generic enough to reuse for NDTV content, or
// whether NDTV needs its own blocklist file, then wire the import in below.
// Left out entirely for now rather than guessing a path that could break the
// build on deploy.
// import { isBlockedNDTVHeadline } from "./ndtvHeadlineFilter.js";

const MAX_AGE_MIN = 60;
// Bumped from 6h to match CA's 24h retention -- CA's comment notes this
// exists specifically so a same-day pubDate bump on an already-tweeted
// article can't slip past dedup. Confirm whether NDTV republishes/bumps
// pubDate the same way CA does; if not, this can safely drop back down.
const SEEN_RETENTION_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 6 * 60 * 60 * 1000; // dailyContext prune window, matches CA
const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";

export async function ndtvNewspolling() {
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready. Skipping NDTV polling.");
    return false;
  }

  const STATE = global.STATE;

  STATE.ndtv ??= {};
  STATE.ndtv.seen ??= {};

  // ── Shared dailyContext bootstrap ────────────────────────────────────────
  // IMPORTANT: STATE.dailyContext is shared with the CA poller for
  // cross-source duplicate detection (judgeNewsContext reads/writes the same
  // array from both loops). CA bootstraps it as a plain { contexts: [] }
  // with no `date` field and prunes entries by age. The previous version of
  // this file bootstrapped it as { date: today, contexts: [] } and replaced
  // the whole object whenever `date !== today` -- since CA never sets
  // `date`, that comparison was true on literally every NDTV poll, wiping
  // out CA's contexts (and NDTV's own) every single cycle. Fixed to match
  // CA's shared-state contract: no date-keyed reset, prune by age instead.
  STATE.dailyContext ??= { contexts: [] };

  // ── Prune stale state ─────────────────────────────────────────────────────
  let stateDirty = false;
  stateDirty ||= pruneSeen(STATE, SEEN_RETENTION_MS);
  stateDirty ||= pruneDailyContext(STATE, RETENTION_MS);

  if (stateDirty) await saveState(STATE, "prune cleanup");

  try {
    // ── Fetch + filter RSS ────────────────────────────────────────────────
    const items = await fetchNDTVCricketRSS();
    if (!Array.isArray(items) || items.length === 0) {
      console.log("ℹ️ No NDTV RSS items");
      return false;
    }

    const sorted = [...items]
      .filter(isNDTVArticle)
      .sort((a, b) => getPubDate(b) - getPubDate(a));

    let selected = null;

    for (const item of sorted) {
      const pubMs = getPubDate(item);

      if (pubMs) {
        const ageMin = (Date.now() - pubMs) / 60000;
        if (ageMin > MAX_AGE_MIN) continue;
      }

      const cleanLink = normalizeNDTVLink(item.link);
      if (!cleanLink) continue;

      if (STATE.ndtv.seen[cleanLink]) continue;

      // TODO: headline-level blocked-pattern check goes here once the
      // NDTV/shared blocklist import above is wired in, e.g.:
      // if (isBlockedNDTVHeadline(item.title)) {
      //   STATE.ndtv.seen[cleanLink] = Date.now();
      //   continue;
      // }

      selected = item;
      break;
    }

    if (!selected) {
      console.log("🟡 No eligible NDTV articles (age + dedupe)");
      return false;
    }

    const cleanLink = normalizeNDTVLink(selected.link);
    const pubMs = getPubDate(selected);

    // ── Fetch article body ──────────────────────────────────────────────────
    let parsed = null;

    try {
      const html = await fetchNDTVArticle(selected.link);
      parsed = parseNDTVArticle(html);
    } catch (err) {
      console.warn(
        "⚠️ NDTV article fetch failed, falling back to RSS description:",
        err?.message || err,
      );

      const rssDesc = selected.description?.trim();
      if (rssDesc && rssDesc.length > 30) {
        parsed = {
          headline: selected.title,
          body: rssDesc,
        };
      }
    }

    if (!parsed?.headline || !parsed?.body || parsed.body.length < 30) {
      console.warn("⚠️ No usable NDTV body, skipping article");
      STATE.ndtv.seen[cleanLink] = Date.now();
      await saveState(STATE, "invalid article structure");
      return false;
    }

    const fullText = `${parsed.headline}\n${parsed.body}`;

    // TODO: full-body blocked-pattern check goes here too, mirroring CA's
    // second filter pass (title-only isn't enough -- CA also screens the
    // combined headline+body text before generating anything):
    // if (isBlockedNDTVHeadline(fullText)) {
    //   console.log(`⏭️ Skipping blocked-pattern article (body match): ${parsed.headline}`);
    //   STATE.ndtv.seen[cleanLink] = Date.now();
    //   await saveState(STATE, "blocked content pattern found in body");
    //   return false;
    // }

    let articleType = "player_form";
    try {
      articleType = await classifyArticle(fullText);
      console.log(`🏷️ Classified as: ${articleType}`);
    } catch (err) {
      console.warn("⚠️ classifyArticle failed, using default:", err?.message);
    }

    let contextDecision = null;
    try {
      // Fixed: now passes fullText (headline + body) like CA does, instead
      // of body only -- the headline usually carries the sharpest signal
      // for judgeNewsContext to tell two stories apart.
      contextDecision = await judgeNewsContext({
        articleText: fullText,
        existingContexts:
          STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
      });

      console.log(
        `📊 Scores — significance: ${
          contextDecision?.significanceScore ?? "n/a"
        }, virality: ${contextDecision?.viralityScore ?? "n/a"} — "${
          parsed.headline
        }"`,
      );

      if (
        contextDecision?.isAlreadyCovered === true &&
        contextDecision?.confidence >= 0.8
      ) {
        console.log("🔁 NDTV context already covered — skipping");
        STATE.ndtv.seen[cleanLink] = Date.now();
        STATE.ndtv.lastLink = cleanLink;
        STATE.ndtv.lastTitle = selected.title;
        STATE.ndtv.visibleDate = new Date(pubMs).toUTCString();
        await saveState(STATE, "duplicate context skipped");
        return false;
      }

      const isExempt = SIGNIFICANCE_EXEMPT_TYPES.has(articleType);
      const score = contextDecision?.significanceScore ?? 10;

      // temporary commented but very important and needed for future use
      if (!isExempt && score < 7) {
        // if (!isExempt) {
        console.log(
          `⬇️ Low significance (${score}/10) — skipping: ${selected.title}`,
        );
        STATE.ndtv.seen[cleanLink] = Date.now();
        STATE.ndtv.lastLink = cleanLink;
        STATE.ndtv.lastTitle = selected.title;
        STATE.ndtv.visibleDate = new Date(pubMs).toUTCString();
        await saveState(STATE, "low significance skipped");
        return false;
      }

      if (isExempt) {
        console.log(
          `🌟 Exempt type (${articleType}) — bypassing significance gate (score: ${score}/10)`,
        );
      } else {
        console.log(`✅ Significance: ${score}/10 — proceeding`);
      }
    } catch (err) {
      console.warn(
        "⚠️ NDTV context judge failed, proceeding without dedup:",
        err?.message || err,
      );
    }

    // ── Step 3: Tweet generation ─────────────────────────────────────────────
    // GPT is primary here (Claude is not currently wired into the NDTV
    // path), Gemini is the fallback. Fixed: log labels below now correctly
    // say GPT/Gemini instead of the old copy-pasted "Claude" labels, which
    // would have pointed debugging at the wrong engine on a real failure.
    let tweetText = null;
    let generatedPath = null;

    try {
      const { tweetText: gptTweet, card } = await generateGPTTweetWithType(
        fullText,
        articleType,
      );

      tweetText = gptTweet;

      console.log("tweetToPost NDTV (GPT):::", gptTweet, "card::", card);

      if (card) {
        try {
          generatedPath = await generateCardImage(
            CREX_BASE_IMAGE_TEMPLATE,
            card,
          );
          console.log("GPT generatedPath:::", generatedPath);
        } catch (err) {
          console.error("❌ Image generation failed:", err);
        }
      } else {
        console.log("📝 Text-only tweet (no card)");
      }
    } catch (err) {
      console.warn("⚠️ GPT failed:", err?.message || err);
    }

    if (!tweetText || tweetText.trim().length < 30) {
      try {
        const { tweetText: geminiTweet, card } =
          await generateGeminiTweet(fullText);

        tweetText = geminiTweet;

        console.log("Gemini fallback tweetText::", tweetText, "card::", card);

        if (card) {
          try {
            generatedPath = await generateCardImage(
              CREX_BASE_IMAGE_TEMPLATE,
              card,
            );
            console.log("Gemini generatedPath:::", generatedPath);
          } catch (err) {
            console.error("❌ Image generation failed:", err);
          }
        } else {
          console.log("📝 Text-only tweet (no card)");
        }
      } catch (err) {
        console.warn("⚠️ Gemini failed:", err?.message || err);
      }
    }

    if (!tweetText || tweetText.trim().length < 30) {
      STATE.ndtv.seen[cleanLink] = Date.now();
      await saveState(STATE, "tweet generation failed or too short");
      return false;
    }

    // Fixed: NDTV tweets now get the source-signature marker like CA does
    // (previously never called at all -- NDTV tweets were going out with no
    // marker, indistinguishable from a manual tweet at a glance).
    tweetText = applySourceSignature(tweetText, "NDTV");
    tweetText = tweetText.trim().replace(/\.?$/, ".");

    const tweetId = `NDTV:${cleanLink}`;

    if (CONSOLE_ONLY) {
      console.log("tweetText::", tweetText);
      console.log("🧪 CONSOLE_ONLY mode. Not enqueueing.");
      // Fixed: still mark as seen even in console-only test mode, so a test
      // run doesn't reprocess (and re-bill) the same article every poll.
      STATE.ndtv.seen[cleanLink] = Date.now();
      await saveState(STATE, "console-only test run");
      return false;
    }

    enqueueTweet({
      id: tweetId,
      source: "NDTV",
      text: tweetText,
      imageUrl: generatedPath || null,
      seenKey: cleanLink,
      publishedAt: pubMs || Date.now(),
    });

    console.log(`📥 Queued NDTV tweet: ${selected.title}`);

    STATE.ndtv.seen[cleanLink] = Date.now();
    STATE.ndtv.lastLink = cleanLink;
    STATE.ndtv.lastTitle = selected.title;
    STATE.ndtv.visibleDate = new Date(pubMs).toUTCString();

    if (
      contextDecision?.newContext &&
      !contextExists(STATE, contextDecision.newContext)
    ) {
      STATE.dailyContext.contexts.push({
        summary: contextDecision.newContext,
        source: "NDTV",
        link: cleanLink,
        createdAt: new Date().toISOString(),
      });
    }

    await saveState(STATE, "NDTV published");
    console.log(`✅ NDTV published: ${selected.title}`);
    return true;
  } catch (err) {
    console.error("❌ ERROR in NDTV polling:", err);
    return false;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getPubDate(item) {
  return item?.pubDate ? new Date(item.pubDate).getTime() : 0;
}

function pruneSeen(STATE, retentionMs) {
  try {
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.ndtv?.seen || {})) {
      if (now - ts > retentionMs) {
        delete STATE.ndtv.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old NDTV seen entries`);
      return true;
    }
  } catch (err) {
    console.warn("⚠️ NDTV seen prune failed:", err?.message || err);
  }
  return false;
}

function pruneDailyContext(STATE, retentionMs) {
  try {
    const ctx = STATE.dailyContext?.contexts;
    if (!Array.isArray(ctx) || ctx.length === 0) return false;

    const now = Date.now();
    const before = ctx.length;

    STATE.dailyContext.contexts = ctx.filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return Number.isFinite(t) && now - t <= retentionMs;
    });

    const after = STATE.dailyContext.contexts.length;

    if (before !== after) {
      console.log(`🧹 Pruned ${before - after} old dailyContext entries`);
      return true;
    }
  } catch (err) {
    console.warn("⚠️ dailyContext prune failed:", err?.message || err);
  }
  return false;
}

function contextExists(STATE, summary) {
  if (!STATE.dailyContext?.contexts?.length) return false;
  const norm = normalizeSummary(summary);
  return STATE.dailyContext.contexts.some(
    (c) => normalizeSummary(c.summary) === norm,
  );
}

function normalizeSummary(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
