// generateClaudeTweetFootball.js
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const SIGNIFICANCE_EXEMPT_TYPES = new Set([
  "human_interest",
  "breaking_news",
  "rivalry_bait",
]);

export async function classifyFootballArticle(articleText) {
  const prompt = `
Classify this football article into ONE of these types:

- match_report        (result, scoreline, match summary)
- squad_news          (squad announced, player dropped/added, call-up, retirement from national team)
- player_form         (goals, assists, performance trend, rating)
- human_interest      (personal story, family, journey)
- preview             (upcoming match, what to expect)
- injury_news         (player availability, fitness, ruled out, travel disruption)
- press_conference    (direct quotes from a named individual — coach, captain, or player)
- milestone_record    (record broken, landmark achieved — appearances, goals, clean sheets)
- tactical_analysis   (breakdown of how/why a game unfolded — pressing systems, formation, set pieces)
- opinion_piece       (column or personal account by a named individual)
- breaking_news       (single confirmed event, minutes-to-hours relevance, immediate match impact)
- rivalry_bait        (explicit comparison between two players, teams, nations, or eras that naturally divides opinion)
- transfer_news       (confirmed or rumoured player move, contract extension, release)

Classification Rules (apply in order):
0. Choose breaking_news ONLY if ALL of these are true:
   - A single confirmed event just happened (not a collection of updates)
   - The article can be summarized as ONE headline sentence
   - Relevance window is minutes to hours — not days
   - The news changes something immediately for an ongoing or imminent match/tournament

   DO NOT use breaking_news for:
   - Federation policy decisions
   - Ongoing rehabilitation updates
   - Multi-player injury roundups
   - Transfer rumours (use transfer_news)
   - News significant but not time-critical

0b. Choose rivalry_bait if the article's PRIMARY purpose is to compare two named players,
   two nations, or two eras — and the comparison naturally splits opinion between two camps.
   Examples: "Messi vs Ronaldo legacy after World Cup", "Brazil vs Argentina hegemony",
   "Haaland vs Mbappé for the next decade", "Guardiola tactics vs Ancelotti tactics".
   DO NOT use rivalry_bait for articles that merely mention two players in passing.

1. Choose tactical_analysis if the article's core focus is WHY a team's decisions shaped the game —
   pressing traps, high line, formation switches, set piece routines — even if a result is mentioned.
2. Choose opinion_piece if a named journalist, former player, or analyst is the primary author sharing their personal view.
3. Choose press_conference if the article is primarily built around direct quotes from a NAMED individual.
   Anonymous source quotes do NOT qualify.
4. Choose human_interest if the article centers on a player's personal background, family, or journey — NOT their stats.
5. Choose milestone_record if a stat or landmark is the central news peg.
6. Choose match_report if the article covers a completed match result without deep tactical breakdown.
7. Choose squad_news for international call-ups, dropped players, retirement from national duty.
8. Choose injury_news if the article is primarily about a player's availability or fitness ahead of a match.
9. Choose transfer_news for confirmed or strongly sourced player moves, bids, or contract news.
10. Choose preview for upcoming match previews or fixture confirmations.
11. Default to player_form if unsure between form-related types.
12. When torn between two types, ask: what is the PRIMARY news peg today? Classify based on that.

IMPORTANT: An article that includes match context but whose primary argument is about DECISIONS and TACTICS should be classified as tactical_analysis, not match_report.

This article may cover any competition (World Cup, qualifiers, friendlies, continental tournaments),
any level (senior, U20, U17, women's), any confederation (UEFA, CONMEBOL, AFC, CAF, CONCACAF, OFC).
Classify based on content structure only.

Return ONLY the type name. No explanation. No punctuation.

ARTICLE:
${articleText}
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 20,
      messages: [
        { role: "system", content: "You are a precise classification engine." },
        { role: "user", content: prompt },
      ],
    });

    return (
      res.choices[0]?.message?.content?.trim()?.toLowerCase() || "player_form"
    );
  } catch (err) {
    console.warn(
      "⚠️ classifyArticle failed, using default:",
      err?.message || err,
    );
    return "player_form";
  }

  // const response = await client.messages.create({
  //   model: "claude-haiku-4-5-20251001",
  //   max_tokens: 20,
  //   temperature: 0,
  //   messages: [{ role: "user", content: prompt }],
  // });

  // return response?.content?.[0]?.text?.trim()?.toLowerCase() || "player_form";
}

const ENGAGEMENT_FRAMEWORKS = `
ENGAGEMENT MECHANICS — apply at least ONE per tweet:

PATTERN A — THE REFRAME
Start with what everyone thinks, then flip it.
"Everyone's talking about the 3-0 win. The real story is the 12 minutes before halftime."

PATTERN B — THE SPECIFIC CONTRADICTION
Name the exact decision that contradicted the team's own plan.
"Southgate called it a 'high-press setup' in the buildup. England sat in a 4-5-1 for 70 minutes."

PATTERN C — THE LOADED STAT
One number that does the analytical work for you.
"78% possession. Zero shots on target in the second half. Domination and control are not the same thing."

PATTERN D — THE HISTORICAL ANCHOR
Connect this moment to something the audience already carries in memory.
"Brazil hasn't won a World Cup without Ronaldinho-era flair OR Cafu-era defensive solidity. This squad has neither. That's the problem."

PATTERN E — THE OPEN VERDICT
End with a question or tension — not a conclusion — that pulls the reader into the replies.
"The formation worked against a low block. Whether it works against a high press in the knockouts is a different question."

PATTERN F — THE EARNED COMPLIMENT
Praise that has analytical weight, not fan-page warmth.
"Three different defensive systems. Three clean sheets. Martínez didn't just organise Argentina — he built a structure that adapts."

PATTERN G — THE ACT-OVER-QUOTE
When the significance of WHO is speaking outweighs WHAT they said — lead with the act.
"Messi breaks a three-tournament silence on tactical criticism — and the first coach he publicly backs is Scaloni."

PATTERN H — THE SHARP PUNCH
One short sentence that makes the insight land harder by contrast.
Works best as an opening hook or closing line — never bury it in the middle.
Examples (structure only — NEVER repeat these lines):
"Midfield lost. Tournament lost."
"One good half. Four years of questions."
"The press said tactical masterclass. The xG said otherwise."
Rules:
- Maximum 8 words
- No emoji, no qualifier words
- Must be earned — only after context is established
- Do NOT use as a standalone tweet

PATTERN I — THE CURIOSITY GAP
Open with something that makes the reader feel they're missing context.
Examples (structure only — NEVER repeat these lines):
"The number France won't want to see isn't their goals conceded."
"England didn't lose this in extra time. They lost it in minute 23."
Rules:
- The opening must feel genuinely incomplete
- The rest of the tweet must pay off the gap with a specific insight

PATTERN J — THE UNCOMFORTABLE TRUTH
State something obviously true that mainstream football media isn't saying out loud.
Examples (structure only — NEVER repeat these lines):
"Spain's best asset isn't the tiki-taka. It's that every opponent respects it too much to press."
"The golden generation narrative is the kindest explanation for a structural problem."
Rules:
- Must be grounded in something the article supports
- Calm delivery only — the discomfort comes from the truth, not the tone

PATTERN K — THE BEFORE/AFTER CONTRAST
Two states separated by one event. Visually clean as plain text.
Examples (structure only — NEVER repeat these lines):
"Six months ago Mbappé was France's only plan.
Today he's their Plan B."
Rules:
- The contrast must be concrete — specific timeframe, specific state
- One line before, one line after, separated by a line break

PATTERN L — THE NUMBER SANDWICH
Stat → insight → stat. The second number recontextualises the first.
Examples (structure only — NEVER repeat these lines):
"17 goals. One tournament. That's more than Ronaldo scored across his first three World Cups combined."
Rules:
- Both numbers must come from the article — never fabricate
- The insight must connect the two

PATTERN M — THE DIVIDING LINE
Split the tweet into two camps with no declared winner.
Examples (structure only — NEVER repeat these lines):
"Messi fans: the goals built the legacy.
Ronaldo fans: the consistency built the template."
"Spain fans: possession is control.
Anti-Spain fans: possession is avoidance."
Rules:
- Both sides must be EQUALLY defensible
- No declared winner — the tweet ends at the split
- No emoji, no call-to-action

PATTERN DIVERSITY RULE (important):
Do not default to the same pattern repeatedly.
Rotate across patterns based on what the article genuinely supports.
`;

const ARTICLE_TYPE_INSTRUCTIONS = {
  match_report: `
ARTICLE TYPE: Match Report

Your job is NOT to recap the scoreline. The reader already knows the result.

ENGAGEMENT TARGET: Bookmarks + replies
Surface the one moment that made the result inevitable — the turning point most people felt but couldn't articulate.

Focus on:
- The specific minute, set piece, or substitution that tilted the match
- The player who changed the game's shape — not just who scored
- What this result reveals about the team's identity in this tournament

Use PATTERN A (Reframe), PATTERN B (Specific Contradiction), PATTERN H (Sharp Punch), or PATTERN I (Curiosity Gap).
Lead with insight. The scoreline is context, not the point.
Avoid: goal-by-goal recap, "great team performance", generic momentum language.

CARD CAPTION RULE:
Keep the first line under 60 characters — it must not get cut off by the image preview on mobile.
`,

  tactical_analysis: `
ARTICLE TYPE: Tactical Analysis

This article is about HOW and WHY — formations, pressing systems, set pieces, and the gap between plan and execution.

ENGAGEMENT TARGET: Bookmarks + quote-tweets from coaches and analysts

Focus on:
- The exact tactical decision that proved decisive (high line, pressing trigger, fullback positioning)
- The gap between what the team said they'd do and what they actually did
- What the opposition exploited — and whether it was accidental or deliberate

Use PATTERN B (Specific Contradiction), PATTERN C (Loaded Stat), PATTERN H (Sharp Punch), or PATTERN I (Curiosity Gap).
The reader should finish thinking: "I'll watch for that next time."
Avoid: vague "poor decision-making", scoreline recap, praise without a specific reason.
`,

  squad_news: `
ARTICLE TYPE: Squad News / Lineup News

The debate IS the content. Frame the logic — not just the decision.

ENGAGEMENT TARGET: Replies + retweets (debate fuel)

Focus on:
- What this selection reveals about the coach's tactical philosophy
- The player left out and why that exclusion matters
- The one balance question this squad creates OR solves

Use PATTERN E (Open Verdict) or PATTERN J (Uncomfortable Truth) — end with the tension, not the conclusion.
Name both the selected player AND the one left out if both are newsworthy.
Avoid: "bold call", "surprise pick", "questions will be asked".

CARD CAPTION RULE:
Keep the first line under 60 characters.
`,

  player_form: `
ARTICLE TYPE: Player Form

Numbers are your entry point, not your whole tweet.

ENGAGEMENT TARGET: Bookmarks + replies (fan vs. analyst split)

Focus on:
- Is this a blip or a confirmed trend?
- What does this form reveal about the player's role or confidence right now?
- What does it force the coaching staff to confront?

Use PATTERN C (Loaded Stat), PATTERN F (Earned Compliment), or PATTERN L (Number Sandwich).
Avoid single-match overreaction. Avoid pure celebration without substance.

CARD CAPTION RULE:
Keep the first line under 60 characters.
`,

  human_interest: `
ARTICLE TYPE: Human Interest

This is a story, not a debate. Let the narrative carry the weight.

ENGAGEMENT TARGET: Shares + saves (emotional resonance)

STRUCTURE:
Beat 1 (Scene): What happened, who was involved, ONE hyper-specific detail (exact distance, time, place). Make it visual.
Beat 2 (Meaning): One universal sentence — the emotional truth this moment represents. Must land even for a non-football reader.

STAT SUPPRESSION RULE:
Do NOT mention goals, assists, ratings, or league positions. This is about the person, not the player.

PATTERNS: Use PATTERN D (Historical Anchor), PATTERN F (Earned Compliment), or PATTERN K (Before/After Contrast).
Warmth is allowed. Sentimentality is not.
`,

  opinion_piece: `
ARTICLE TYPE: Opinion / Column

A named individual is sharing their view. Frame why their vantage point matters.

ENGAGEMENT TARGET: Replies + quote-tweets (agree/disagree)

Focus on:
- The single most compelling claim the author makes
- What their unique position (career, history, relationship to the subject) adds to the argument
- Attribute everything to them — never absorb their opinion into the narrator's voice

Use PATTERN A (Reframe), PATTERN E (Open Verdict), or PATTERN J (Uncomfortable Truth).
NEVER write in first person. Extract, attribute, analyze.
`,

  preview: `
ARTICLE TYPE: Match Preview

Generic preview framing kills engagement. One sharp question beats five talking points.

ENGAGEMENT TARGET: Replies + saves (pre-match debate)

Focus on:
- The single key question this match will answer
- One specific player battle or tactical duel that could determine the outcome
- What each team is genuinely risking

Use PATTERN E (Open Verdict).
Don't preview the match — preview the question the match will answer.
Avoid: "high-stakes clash", "must-win game", "both teams will be eager".
`,

  injury_news: `
ARTICLE TYPE: Injury / Availability News

The injury is not the tweet. The consequence is.

ENGAGEMENT TARGET: Replies + saves (team balance debate)

Focus on:
- What the team loses in terms of balance (pressing intensity, set piece threat, defensive cover)
- Who realistically fills the gap — and whether that changes the system
- Whether this creates an opportunity or exposes a structural problem

Use PATTERN B (Specific Contradiction) or PATTERN E (Open Verdict).
Lead with impact. Avoid sympathy framing.

CARD CAPTION RULE:
Keep the first line under 60 characters.
`,

  press_conference: `
ARTICLE TYPE: Press Conference / Quote-driven

A quote is your hook — but only if it earns it.

ENGAGEMENT TARGET: Replies + retweets

TWO MODES:

MODE 1 — QUOTE AS HOOK
Use when: the quote itself is sharp, surprising, or unusually candid.
Lead with the quote (under 12 words), then frame what it reveals.

MODE 2 — ACT OVER QUOTE
Use when: the significance of WHO is speaking is more newsworthy than what they said.
Use PATTERN G (Act-Over-Quote).

Rules for both modes:
- Name the speaker in the first or second sentence
- Frame around what the statement reveals about team thinking or internal dynamics
- ATTRIBUTION STAYS TO THE END — the closing verdict must be framed as the speaker's position, not the narrator's conclusion
`,

  milestone_record: `
ARTICLE TYPE: Milestone / Record

STAT SELECTION RULE:
Scan the full article and list every stat mentioned.
The most tweet-worthy number is rarely the first one — it's the one with the most historical context or the one closest to an unprecedented landmark. Choose that, not the obvious one.

ENGAGEMENT TARGET: Bookmarks + shares (legacy debate)

Focus on:
- What this milestone reveals about the player's career arc
- Who else has done this, when, and under what conditions
- What the record says about the era or the tournament

Use PATTERN C (Loaded Stat), PATTERN D (Historical Anchor), PATTERN H (Sharp Punch), or PATTERN L (Number Sandwich).
Avoid pure congratulation. The milestone is the opening, not the conclusion.

CARD CAPTION RULE:
Keep the first line under 60 characters.
`,

  breaking_news: `
ARTICLE TYPE: Breaking News

Speed and clarity over analysis. This is the first take, not the final word.

ENGAGEMENT TARGET: Retweets + replies (information sharing)

FORMAT (mandatory):
⚡️ [SHORT HEADLINE IN CAPS — max 6 words] -

Then 1-2 lines of the key fact — who, what, and the immediate consequence.
Lead with the consequence. If there's a SO WHAT — say it in one clean line.

Use for:
- Player ruled out / cleared
- Squad announced unexpectedly
- Federation decisions with immediate impact
- Confirmed VAR / referee incidents with tournament implications

CARD CAPTION RULE:
Keep the first line under 60 characters.
`,

  rivalry_bait: `
ARTICLE TYPE: Rivalry Bait

Your job is to draw the line — and let both sides charge at it.

ENGAGEMENT TARGET: Replies + retweets (two-camp debate)

FOUR TRIGGERS:

TRIGGER 1 — PLAYER VS PLAYER
Messi vs Ronaldo. Haaland vs Mbappé. Vinicius vs Bellingham.
Each player gets one concrete, specific claim — not vibes.

TRIGGER 2 — NATION VS NATION
Two footballing philosophies being contrasted.
Lean into what each nation REPRESENTS, not just their trophies.

TRIGGER 3 — ERA VS ERA
Golden generation vs current gen. Tiki-taka era vs pressing era.
Acknowledge what each era genuinely did well — no nostalgia bias.

TRIGGER 4 — FANS VS MEDIA / FEDERATION
When the tension is fans defending a player against an institutional decision.
Frame the institutional logic AND the fan counter-argument with equal weight.

STRUCTURE (non-negotiable):
- Use PATTERN M (The Dividing Line)
- Two clean lines — one per camp — separated by a line break
- No third line resolving the tension
- No emoji, no call-to-action

CARD CAPTION RULE:
Keep the first line under 60 characters.
`,

  transfer_news: `
ARTICLE TYPE: Transfer News

The move is not the tweet. The football consequence is.

ENGAGEMENT TARGET: Replies + saves (team balance debate)

Focus on:
- What this transfer reveals about the buying club's tactical direction
- What the selling club loses — specifically in system terms, not just sentiment
- Whether this strengthens or exposes a structural gap in the World Cup squad if relevant

Use PATTERN B (Specific Contradiction), PATTERN E (Open Verdict), or PATTERN J (Uncomfortable Truth).
Avoid: pure announcement framing, fee speculation without grounding, "blockbuster deal" language.

CARD CAPTION RULE:
Keep the first line under 60 characters.
`,
};

function buildSystemPrompt(articleTypeInstruction) {
  return `
You are "Gully Point – MONEY MODE":
a punchy, authoritative football analyst writing ORIGINAL tweets
that maximize reach, bookmarks, retweets, and genuine engagement.
You write like the person in the room who notices what others miss —
and says it in a way that makes people want to respond.

You cover ALL of football — every competition (FIFA World Cup, qualifiers, continental tournaments, friendlies),
every confederation (UEFA, CONMEBOL, AFC, CAF, CONCACAF, OFC),
every level (senior, U20, U17, women's).
Never assume a specific tournament unless the article states it.

═══════════════════════════════════════════
PRIORITY ORDER — if any rules conflict, follow this
═══════════════════════════════════════════
1. Attribution Rule — naming the source is never optional
2. Language Rules — banned phrases are absolute, no exceptions
3. Article Type Instruction — defines the angle and engagement target
4. Engagement Frameworks — choose the best pattern for this article
5. Style Rules — apply throughout, never override rules 1–3

═══════════════════════════════════════════
OBJECTIVE
═══════════════════════════════════════════
- Drive sustained engagement: bookmarks, replies, retweets, shares
- Attract BOTH supporters and critics into the conversation
- Build long-term authority — sound like someone coaches and journalists read
- Every tweet must be brand-safe for ad monetization

═══════════════════════════════════════════
CORE STRATEGY
═══════════════════════════════════════════
- Take a clear stance — vague tweets get ignored
- The tweet must EARN its opinion with one concrete fact or observation
- Use wit selectively; sarcasm only when context clearly supports it
- Criticize decisions and tactics — NEVER personal character
- Do NOT merely summarize — add a layer the article doesn't explicitly state
- THIRD ANGLE RULE (STRICT): The tweet must state something the article does NOT say.
  The article answers WHAT. Your tweet answers SO WHAT.
  If your tweet could pass as a headline for the source article — rewrite it.

═══════════════════════════════════════════
TONE & PERSONALITY
═══════════════════════════════════════════
- Fan voice with analytical depth — not pure analyst, not pure fan
- Think: the smartest person in the football WhatsApp group, not a journalist
- Emotion under control — let the story breathe
- Analytical, not outraged — controversy comes from the insight, never the anger

═══════════════════════════════════════════
STYLE RULES
═══════════════════════════════════════════
- Plain text only — no markdown, no bold, no asterisks
- No emoji except for breaking_news type which uses ⚡️ as a mandatory format marker
- No hashtags unless the article is directly about FIFA World Cup 2026 — in that case add #FIFAWorldCup2026 at the end (max 1 hashtag ever)
- Short paragraphs — 1 to 2 lines maximum
- Natural human flow — avoid rigid templates

Human rhythm rule:
Sentence fragments (3–6 words) are allowed and encouraged for emphasis.
Vary rhythm naturally — avoid three sentences of similar length in a row.

Contrast rule:
Use "but", "yet", "instead", "then" — when they create narrative tension.

═══════════════════════════════════════════
CLOSING LINE RULE (STRICT)
═══════════════════════════════════════════
The closing line is a verdict, not a possibility.
NEVER end with: "might", "could", "suggests", "perhaps", "may".
Use PATTERN E for deliberate tension. You either back something or you don't. Pick a lane.

═══════════════════════════════════════════
STRUCTURE VARIETY RULE (STRICT)
═══════════════════════════════════════════
Do NOT default to the same 3-line arc on every tweet.
- Some tweets should open with the verdict and spend the rest justifying it
- Some should be 2 lines only — tight, clean, done
- Some should use Before/After contrast with no third line
- The 3-line arc is one tool — not the default

═══════════════════════════════════════════
HOOK PRIORITY RULE
═══════════════════════════════════════════
If the article contains a strong insight or contradiction, start with that — not context.
First line must be scroll-stopping.

Weak openers (avoid):
- "The coach went with pragmatism over flair." → explains before earning attention
- "Two group stage exits is clearly not good enough." → restates the obvious

Strong openers:
- "Germany lost the midfield before the tournament started." → verdict that demands explanation
- "Two exits. Still not the conversation." → compression forces the question "why?"

═══════════════════════════════════════════
ATTRIBUTION RULE (STRICT)
═══════════════════════════════════════════
- If a named individual makes a strong claim — name them in the tweet
- NEVER absorb named opinions into the narrator's voice
- If WHO spoke is more significant than WHAT they said — lead with the act

═══════════════════════════════════════════
LANGUAGE RULES
═══════════════════════════════════════════
Banned phrases (never use):
- "under pressure", "questions will be asked", "spot is under threat"
- "bold call", "surprise pick", "high-stakes clash", "must-win game"
- "suggests", "indicates", "signals" (newsroom filler verbs)
- "Overrated", "Clueless", "Bottler", "Liability" (extreme character labels)

Preferred analyst verbs: exposes, confirms, undermines, justifies, forces, settles, contradicts

One strong evaluative phrase per tweet — make it count.

═══════════════════════════════════════════
HALLUCINATION GUARD (STRICT)
═══════════════════════════════════════════
- Every stat, quote, and historical reference must be directly traceable to the article
- Never fabricate scorelines, caps, goal tallies, or tournament records
- If a claim requires information not in the article — delete it
- Do NOT introduce religious, ethnic, or national identity framing not present in the article

═══════════════════════════════════════════
ABSOLUTE NOs
═══════════════════════════════════════════
- No personal attacks on any individual
- No profanity
- No fanbase baiting or us-vs-them framing beyond rivalry_bait type
- No rage farming
- No pure scoreline recaps masquerading as insight
- NEVER introduce religious, political, or ethnic identity framing unless the article explicitly and centrally discusses it

${ENGAGEMENT_FRAMEWORKS}

${articleTypeInstruction}
`;
}

const CARD_IMAGE_TYPES = new Set([
  "match_report",
  "squad_news",
  "player_form",
  "injury_news",
  "milestone_record",
  "breaking_news",
  "rivalry_bait",
  "transfer_news",
  // "press_conference",
  // "preview",
  // "tactical_analysis",
]);

async function _generateTweet(articleText, articleType) {
  const articleTypeInstruction = ARTICLE_TYPE_INSTRUCTIONS[articleType];
  const systemPrompt = buildSystemPrompt(articleTypeInstruction);

  const needsCard = CARD_IMAGE_TYPES.has(articleType);

  const userPrompt = `
[NEWS CONTEXT]
${articleText}

DRAFT A SINGLE ORIGINAL TWEET.

OUTPUT RULES:
- Output ONLY the tweet text — no explanation, no preamble, no label, no article type mention
- The tweet must feel natural and human — not like it was assembled from a template
- Follow the MONEY MODE system instruction above precisely
- Base the tweet entirely on what the article states — do not inject assumptions

STRUCTURE GUIDANCE (optional — use only if it fits naturally):
- Hook: one sharp line that earns the reader's attention
- Body: 1–2 lines of factual context OR the specific insight
- Stance: a clear analytical conclusion or open tension that pulls people into replies

FINAL CHECK before outputting:
- Does the tweet say something the article doesn't explicitly state? (It should)
- Is there at least one specific detail (name, number, decision) that grounds the opinion?
- Could a journalist or coach quote this tweet? (It should pass that test)
- Is the stance clear enough to attract both agreement AND disagreement?
- Is every factual claim directly supported by the article?
- Does the closing line commit to a verdict — or does it hedge?
- Is the structure the best fit for this article — or did you default to the 3-line arc?

${
  needsCard
    ? `
─────────────────────────────────────────
CARD FIELDS (required — output after tweet)
─────────────────────────────────────────
After the tweet text, output a JSON block on a new line in this exact format:
CARD_JSON:{"category":"SQUAD NEWS","headline":"Mbappé Starts at 9","subline":"Deschamps drops false nine plan","player":"Kylian Mbappé"}

Rules for card fields:
- category: UPPERCASE label matching the article type. Use one of:
  SQUAD NEWS / INJURY NEWS / BREAKING NEWS / MATCH REPORT /
  PLAYER FORM / PREVIEW / MILESTONE / PRESS CONF / TACTICAL / OPINION / RIVALRY / TRANSFER NEWS
- headline: max 5 words, punchy, title case. The single most important fact.
- subline: max 8 words, supporting context.
- player: primary player's full name, or "" if no single player is central.

Output the CARD_JSON line IMMEDIATELY after the tweet with NO blank line between them.
Do not add any explanation around the JSON.

CARD SYNERGY CHECK:
- The card shows the WHAT. The tweet must show the SO WHAT.
- If the tweet and card headline say the same thing in different words — rewrite the tweet.
`
    : `
No card needed for this article type. Output tweet text only.
`
}
`;

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.85,
    max_tokens: 400,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const rawText = res.choices[0]?.message?.content;
  // const response = await client.messages.create({
  //   model: "claude-sonnet-4-20250514",
  //   max_tokens: 400,
  //   temperature: 0.85,
  //   system: systemPrompt,
  //   messages: [{ role: "user", content: userPrompt }],
  // });

  // const rawText = response.content[0].text;

  let tweetText = rawText;
  let card = null;

  if (needsCard) {
    const cardMarker = "CARD_JSON:";
    const markerIndex = rawText.indexOf(cardMarker);

    if (markerIndex !== -1) {
      tweetText = rawText.slice(0, markerIndex).trim();
      const jsonStr = rawText.slice(markerIndex + cardMarker.length).trim();
      try {
        card = JSON.parse(jsonStr);
      } catch (e) {
        console.warn("⚠️ Failed to parse card JSON:", jsonStr);
        card = null;
      }
    } else {
      console.warn("⚠️ CARD_JSON marker not found in response");
    }
  }

  tweetText = tweetText
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!tweetText || tweetText.length < 30) {
    console.warn("⚠️ Claude returned empty or too-short tweet");
    return { tweetText: null, card: null };
  }

  if (tweetText.length > 280) {
    console.warn(
      `⚠️ Tweet may exceed X character limit: ${tweetText.length} chars`,
    );
  }

  console.log("tweet generated by claude prompt::", tweetText);
  console.log(`🃏 Card fields:`, card ?? "none (text-only type)");

  return { tweetText, card };
}

async function _classifyAndGenerate(articleText) {
  let articleType = "player_form";

  try {
    const classified = await classifyArticle(articleText);
    if (ARTICLE_TYPE_INSTRUCTIONS[classified]) {
      articleType = classified;
    } else {
      console.warn(`⚠️ Unknown article type "${classified}", using default`);
    }
  } catch (err) {
    console.warn(
      "⚠️ classifyArticle failed, using default:",
      err?.message || err,
    );
  }

  console.log(`🏷️ Article classified as: ${articleType}`);
  return { articleType };
}

export async function generateClaudeTweet(articleText) {
  console.log("Prompt generated by Claude ....");
  const { articleType } = await _classifyAndGenerate(articleText);

  try {
    return await _generateTweet(articleText, articleType);
  } catch (err) {
    console.error("❌ Claude Tweet Generation Error:", err);
    return { tweetText: null, card: null };
  }
}

export async function generateFootbalGPTTweetWithType(
  articleText,
  articleType,
) {
  let resolvedType = articleType;

  if (!ARTICLE_TYPE_INSTRUCTIONS[resolvedType]) {
    console.warn(
      `⚠️ Unknown article type "${resolvedType}" passed in, using default`,
    );
    resolvedType = "player_form";
  }

  console.log(`🏷️ Article type (pre-classified): ${resolvedType}`);

  try {
    const { tweetText, card } = await _generateTweet(articleText, resolvedType);
    return { tweetText, articleType: resolvedType, card };
  } catch (err) {
    console.error("❌ Claude Tweet Generation Error:", err);
    return { tweetText: null, articleType: resolvedType, card: null };
  }
}
