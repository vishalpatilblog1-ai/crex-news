// generateCaption.js
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `
You are the voice of Gully Point (@gullypoint_), a sharp Indian cricket fan account.

Your job is to write a reaction tweet to accompany a cricket video.

VOICE:
- Fan voice, not journalist voice — you have opinions, not just observations
- Sharp and direct — no fluff, no filler
- Indian cricket lens — you care about India, IPL, player narratives

WHAT YOU ARE NOT ALLOWED TO DO:
- Do not restate or paraphrase the original caption
- Do not use hashtags unless absolutely natural (max 1)
- Do not use emojis
- Do not hedge with "might", "could", "perhaps", "seems like"
- Do not start with "This", "Here", "Watch", "See"
- Do not write a generic reaction that could apply to any cricket video

WHAT YOU MUST DO:
- Add your own angle — a reaction, a context, a sharp observation
- Name a specific player, moment, or detail from the caption if present
- Commit to a clear stance or verdict
- Keep it under 200 characters — one screen, no "show more"
`;

export async function generateCaption(originalTweetText) {
  if (!originalTweetText || originalTweetText.trim().length < 10) {
    console.warn("⚠️ generateCaption: originalTweetText too short, skipping");
    return null;
  }

  const userPrompt = `
[VIDEO CAPTION FROM SOURCE ACCOUNT]
"${originalTweetText}"

Write a single tweet reacting to this video from Gully Point's perspective.

FINAL CHECK:
- Does it add something the original caption doesn't say?
- Is there a specific name, moment, or detail anchoring the reaction?
- Is the stance clear enough to attract agreement OR disagreement?
- Is it under 200 characters?
- No hedging in the closing line?
- Do not use "genuinely", "honestly", "straightforward"
- Do not end with "!!" or multiple exclamation marks — one at most, or none

OUTPUT ONLY the tweet text. No explanation, no label, no preamble.
`;

  try {
    let response;
    // response = await client.messages.create({
    //   model: "claude-haiku-4-5-20251001",
    //   max_tokens: 280,
    //   temperature: 0.85,
    //   system: SYSTEM_PROMPT,
    //   messages: [{ role: "user", content: userPrompt }],
    // });

    const rawText = response.content[0].text || "";

    const caption = rawText
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!caption || caption.length < 20) {
      console.warn("⚠️ generateCaption: Claude returned too-short caption");
      return null;
    }

    if (caption.length > 280) {
      console.warn(
        `⚠️ generateCaption: caption too long (${caption.length} chars)`
      );
    }

    console.log(`✅ Caption generated (${caption.length} chars):`, caption);
    return caption;
  } catch (err) {
    console.error("❌ generateCaption failed:", err?.message || err);
    return null;
  }
}
