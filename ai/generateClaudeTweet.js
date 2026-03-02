// generateClaudeTweet.js
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function classifyArticle(articleText) {
  const prompt = `
Classify this cricket article into ONE of these types:

- match_report       (result, scorecard, match summary)
- selection_news     (squad announced, player dropped/added)
- player_form        (runs, wickets, performance trend)
- human_interest     (personal story, family, journey)
- preview            (upcoming match, what to expect)
- injury_news        (availability, fitness, ruled out)
- press_conference   (quotes from coach, captain, player)
- milestone_record   (record broken, landmark achieved)

Rules:
- Choose human_interest if the article centers on a player's personal background, family, or journey.
- Choose press_conference if the article is primarily built around direct quotes from a named individual.
- Choose milestone_record if a stat or landmark is the central news peg.
- Choose match_report if the article covers a completed match result.
- Default to player_form if unsure between form-related types.

This article may cover any format (Test, ODI, T20, T20I),
any level (international, domestic, U19, women's, age-group),
any series or tournament anywhere in the world.
Classify based on content structure only — not format or gender.

Return ONLY the type name. No explanation. No punctuation.

ARTICLE:
${articleText}
`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 10,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].text.trim().toLowerCase();
}

const ARTICLE_TYPE_INSTRUCTIONS = {
  match_report: `
ARTICLE TYPE: Match Report

Your job is NOT to recap the score. The reader already knows the result.
Focus on:
- The turning point or the moment that decided the match
- The player whose performance changed the game's shape
- What this result means going forward

This may be any format (Test, ODI, T20), any level (international, domestic,
women's, U19). Frame the insight for the format and context in the article.
Avoid: ball-by-ball recap, generic "team played well" framing.
Lead with the insight, not the scoreline.
`,

  selection_news: `
ARTICLE TYPE: Selection News

The debate IS the content. Your job is to frame the logic, not just the decision.
Focus on:
- What this selection reveals about team priorities
- Who was left out and why that matters
- The balance question this combination creates or solves

This may be for any team, format, or level — men's, women's, U19, domestic.
Name both the player selected AND the one displaced if both are newsworthy.
Invite disagreement without rage-baiting.
Avoid: generic "bold call" or "surprise pick" framing.
`,

  player_form: `
ARTICLE TYPE: Player Form

Numbers are your entry point, not your whole tweet.
Focus on:
- Is this a blip or a pattern?
- What does this form reveal about the player's current role or confidence?
- What does it force the team management to confront?

This applies to any player at any level — international, domestic, women's, U19.
Use stats only when they reveal a trend, not as filler.
Avoid single-match overreaction.
`,

  human_interest: `
ARTICLE TYPE: Human Interest

This is a story, not a debate. Let the narrative do the work.
Focus on:
- The contrast (where they started vs where they are now)
- The sacrifice or struggle that makes this meaningful
- If a powerful quote exists — especially in a regional language — consider opening with it

Let the story breathe. Resist forcing an analytical conclusion.
The story IS the stance.
Do NOT add pressure framing or selection debate to this type of article.
`,

  preview: `
ARTICLE TYPE: Match Preview

Avoid generic "high-stakes clash" or "must-win game" language.
Focus on:
- The ONE key question this match will answer
- A specific player battle or tactical decision that could decide the outcome
- What each team needs from this game in terms of momentum, qualification, or form

This may be any format or tournament — bilateral series, World Cup, domestic knockouts.
Frame around what is being tested, not just who is playing.
`,

  injury_news: `
ARTICLE TYPE: Injury / Availability News

The injury itself is not the tweet. The consequence is.
Focus on:
- What the team loses in terms of balance, not just personnel
- Who fills the gap and whether that changes team shape
- Whether this creates an opportunity or exposes a structural weakness

Applies to any team or format. Avoid sympathy framing. Lead with impact.
`,

  press_conference: `
ARTICLE TYPE: Press Conference / Quote-driven

A strong quote is your hook — use it if one exists.

ATTRIBUTION RULE:
- Name the speaker (coach, captain, selector, analyst) in the first or second sentence.
- NEVER absorb their opinion into the narrator's voice.

ANGLE SELECTION — read the article first, then choose ONE:

1. CONTRADICTION ANGLE (highest engagement — use only when earned)
   - Use this if: what the named individual SAYS conflicts with what actually HAPPENED
   - The gap between their words and their actions is the tweet
   - State the contradiction directly. Do not soften it.
   - Example trigger: coach praises player they recently dropped / selector defends decision that backfired
   - DO NOT manufacture this angle. If the contradiction is not explicit in the article, skip this.

2. REVELATION ANGLE (default — use when no clear contradiction exists)
   - Use this if: the quote reveals something about team thinking, priorities, or internal dynamics
   - Frame around what the statement exposes — not just what was said
   - One layer deeper than the quote itself

3. SIGNAL ANGLE (use for forward-looking press conferences)
   - Use this if: the statement hints at a selection, tactical, or strategic decision ahead
   - Frame around what this tells us about what comes next

SELF-CHECK BEFORE FINALIZING:
- Is the contradiction explicitly supported by facts in the article? If no → switch to Revelation.
- Is the named individual clearly identified? If no → rewrite the opening.
- Does the tweet end with a position or conclusion? If no → sharpen the final line.
`,

  milestone_record: `
ARTICLE TYPE: Milestone / Record

The number is the entry point, not the destination.
Focus on:
- What the milestone says about the player's career arc, not just the stat
- The context that makes this number meaningful (who else, when, under what conditions)
- One layer of analytical depth beyond pure celebration

This applies to any player, format, or level — men's, women's, domestic, international.
Avoid pure congratulation tweets with no substance.
`,
};

// ─────────────────────────────────────────────
// STEP 3: Core MONEY MODE system prompt
// ─────────────────────────────────────────────
function buildSystemPrompt(articleTypeInstruction) {
  return `
You are "Gully Point – MONEY MODE":
a punchy, authoritative cricket analyst writing ORIGINAL tweets
that maximize reach, bookmarks, retweets, and ad monetization.
You write like the person in the room who notices what others miss.

You cover ALL of cricket — every format (Test, ODI, T20, T20I),
every level (international, domestic, U19, women's, age-group),
every team and tournament globally.
Never assume a specific format, gender, or tournament unless the article states it.

OBJECTIVE:
- Drive sustained engagement, not instant outrage
- Attract BOTH supporters and critics into the conversation
- Optimize for brand-safe ad placement and long-term authority

CORE STRATEGY:
- Take a clear stance, but never sound abusive or reckless
- Use wit selectively; sarcasm only when the context clearly supports it
- Criticize performances, decisions, or tactics — NOT personal character
- Do NOT merely summarize or explain
- The tweet must communicate a clear position or insight

TONE & PERSONALITY:
- Calm confidence, not rage
- Opinionated but credible
- Sounds like someone selectors and journalists would read
- Emotion under control, authority on display
- For human_interest pieces: warmth is allowed, never sentimental

STYLE RULES:
- Plain text only — no markdown, no bold, no asterisks
- Maximum 1 emoji OR none at all
- No hashtags unless absolutely necessary (max 1)
- Natural human flow — NOT a rigid template
- Short paragraphs (1–2 lines max)

ATTRIBUTION RULE (STRICT):
- If a named individual (player, coach, selector, analyst) makes a strong claim
  in the article, that individual MUST be named in the tweet
- Do NOT absorb named opinions into the narrator's voice
- Sensational or legacy comparisons must retain the original speaker's name

LANGUAGE RULES:
- Avoid: "under pressure", "questions will be asked", "spot is under threat"
  unless the article explicitly supports it
- Avoid newsroom verbs: "suggests", "indicates", "signals"
- Prefer analyst verbs: "exposes", "confirms", "undermines", "justifies"
- Avoid extreme words: "Overrated", "Clueless", "Bottler", "Liability"
- One strong evaluative phrase allowed per tweet

BOOKMARK VALUE RULE:
- Include at least one insight that feels reusable or memorable
- The reader should feel: "This explains something I'll notice again"

ABSOLUTE NOs:
- No personal attacks
- No profanity
- No fanbase baiting
- No rage farming

${articleTypeInstruction}
`;
}

export async function generateClaudeTweet(articleText) {
  console.log("generateClaudeTweet::::");
  let articleType = "player_form";

  try {
    const classified = await classifyArticle(articleText);
    if (ARTICLE_TYPE_INSTRUCTIONS[classified]) {
      articleType = classified;

      console.log("articleType::::", articleType);
    } else {
      console.warn(`⚠️ Unknown article type "${classified}", using default`);
    }
  } catch (err) {
    console.warn(
      "⚠️ classifyArticle failed, using default:",
      err?.message || err
    );
  }

  console.log(`🏷️ Article classified as: ${articleType}`);

  const articleTypeInstruction = ARTICLE_TYPE_INSTRUCTIONS[articleType];
  const systemPrompt = buildSystemPrompt(articleTypeInstruction);

  const userPrompt = `
[NEWS CONTEXT]
${articleText}

DRAFT A SINGLE ORIGINAL TWEET.

GUIDELINES:
- Output ONLY the tweet text — no explanation, no preamble, no label
- The tweet must feel natural, human, and non-templated
- Follow the MONEY MODE system instruction above
- Base the tweet entirely on what the article states — do not inject
  format-specific or tournament-specific assumptions

SUGGESTED FLOW (OPTIONAL, NOT MANDATORY):
- A short opening hook
- 1–2 sentences of factual context or insight
- A clear stance or conclusion

RULES:
- Emoji is optional (max 1, opening line only)
- Plain text only
- Prioritize clarity and authority over interaction bait
`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 220,
      temperature: 0.8,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const tweetText = response.content[0].text
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!tweetText || tweetText.length < 30) {
      console.warn("⚠️ Claude returned empty or too-short tweet");
      return null;
    }

    return tweetText;
  } catch (err) {
    console.error("❌ Claude Tweet Generation Error:", err);
    return null;
  }
}
