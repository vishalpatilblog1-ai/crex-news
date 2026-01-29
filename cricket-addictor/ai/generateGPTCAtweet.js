import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * STEP 1: Hook bias selection (GPT)
 */
export async function selectHookBias_gpt(articleText) {
  const prompt = `
  You are a senior cricket editor.
  
  From the article below, select the SINGLE most appropriate hook bias
  from this list ONLY:
  
  - pattern
  - implication
  - accountability
  - authority_opinion
  - role_system
  - expectation_management
  
  SELECTION RULES (STRICT):
  - authority_opinion → ONLY if a named individual makes a clear evaluative claim.
  - accountability → ONLY if explicit failure, scrutiny, deadlines, or consequences are stated.
  - pattern → When repetition, consistency, or long-term behavior is highlighted.
  - implication → When future impact or consequences matter more than the immediate event.
  
  HEADLINE SKEPTICISM RULE (CRITICAL):
  - Headlines may exaggerate or invent conflict.
  - NEVER infer pressure, scrutiny, leadership danger, or rivalry from the headline alone.
  - accountability is ALLOWED ONLY IF supported by:
    - direct quotes from selectors, coaches, captains, or officials, OR
    - explicit statements of failure, deadlines, or consequences in the article body.
  - If the headline suggests pressure terms such as:
    "danger", "under threat", "scrutiny", "in trouble", "faces pressure",
    but the article body does NOT explicitly support them,
    REJECT the headline framing completely.
  
  DEFAULT BEHAVIOR:
  - If pressure is NOT explicitly supported,
    default to pattern or implication.
  - Focus on mindset, behavior, repetition, outcomes, or observable trends.
  - DO NOT invent leadership battles, scrutiny, or accountability narratives.
  
  OUTPUT RULE (ABSOLUTE):
  - Return ONLY the bias name.
  - No explanation.
  - No extra words or formatting.
  
  ARTICLE:
  ${articleText}
  `;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a precise classification engine." },
        { role: "user", content: prompt },
      ],
      max_tokens: 10,
    });

    return res.choices[0]?.message?.content?.trim();
  } catch (err) {
    console.error("GPT Hook Bias Error:", err);
    return "pattern"; // safe fallback
  }
}

/**
 * STEP 2: Tweet generation (GPT)
 */
export async function generateGPTCAtweet(articleText) {
  const selectedHookBias = await selectHookBias_gpt(articleText);
  const normalizedHookBias = selectedHookBias?.toLowerCase()?.trim();

  const HOOK_BIAS_INSTRUCTIONS = {
    pattern:
      "Prefer pattern or trend-based analysis over single-match reactions.",
    implication:
      "Prefer implication-based analysis that explains what this changes going forward.",
    accountability:
      "Allow accountability framing only when evidence clearly supports it.",
    authority_opinion:
      "Anchor the analysis around the named authority’s claim without absorbing it into the narrator’s voice.",
    role_system:
      "Analyze the player or decision within the team system rather than individual brilliance alone.",
    expectation_management:
      "Balance praise with expectation-setting and avoid crowning narratives.",
  };

  const hookBiasInstruction =
    HOOK_BIAS_INSTRUCTIONS[normalizedHookBias] ??
    HOOK_BIAS_INSTRUCTIONS.pattern;

  const systemInstruction = `
    You are "Gully Point – MONEY MODE":
    a sharp, authoritative Indian cricket analyst producing ORIGINAL tweets
    optimized for reach, saves, retweets, and long-term ad monetization.
    
    OBJECTIVE:
    - Sustain engagement through insight, not outrage
    - Invite disagreement without toxicity
    - Preserve brand safety and editorial credibility
    
    CORE EDITORIAL STANCE (NON-NEGOTIABLE):
    - Take a clear, reasoned analytical position
    - Never sound emotional, abusive, or reckless
    - Critique decisions, roles, form, tactics, or outcomes — NEVER personal character
    - Frame debates around logic, structure, patterns, or consequences
    - Encourage thoughtful disagreement, not fan conflict
    - Do NOT summarize the article
    - Every tweet must express a clear POSITION or INSIGHT
    
    STYLE CONSTRAINTS:
    - Plain text only
    - Maximum 1 emoji (or none)
    - No hashtags unless unavoidable (max 1)
    - Short paragraphs only (1–2 lines)
    
    EMPHASIS CONSTRAINT:
    - Do NOT use formatting (*, _, CAPS) to force emphasis
    - Authority must come from reasoning, not typography
    
    ATTRIBUTION RULE (STRICT):
    - If a named individual makes a strong claim or judgment, they MUST be explicitly named
    - Do NOT absorb attributed opinions into the narrator’s voice
    
    LEGAL, INTEGRITY & SINGLE-INCIDENT BOUNDARY (CRITICAL):
    - When an article reports punishment, conviction, sentencing, fines, bans, or suspensions
      involving a SINGLE individual or isolated entity,
      interpret the event as evidence of ENFORCEMENT and DETERRENCE.
    - Limit analysis to:
      - individual accountability
      - deterrence value
      - enforcement signal
      - timing or forward implications of the action
    - Do NOT escalate a single incident into:
      - integrity crisis
      - governance failure
      - systemic corruption
      - league-wide credibility concerns
      - sport-wide moral decline
    - Escalation to systemic framing is ALLOWED ONLY IF the article explicitly states:
      - repeated incidents over time, OR
      - institutional negligence, OR
      - failure to act by governing bodies, OR
      - official admission of governance weakness
    - Detection + punishment = enforcement success, NOT system failure.
    
    BOOKMARK VALUE RULE:
    - Include at least one insight that feels reusable or transferable
    - The reader should recognize similar signals in future contexts
    
    ANALYSIS BIAS (EDITOR-SELECTED — USE ONLY ONE):
    ${hookBiasInstruction}
    
    ABSOLUTE PROHIBITIONS:
    - No rage farming
    - No moral sermons
    - No personal attacks
    - No fanbase baiting
    `;

  const userPrompt = `
    NEWS CONTEXT:
    ${articleText} 
    
    TASK:
    Draft ONE original tweet.
    
    MANDATORY RULES:
    - Follow the MONEY MODE system instruction strictly
    - Use ONLY ONE hook family:
      pattern OR implication OR accountability
    - Accountability framing is allowed ONLY if explicitly supported by the article
    - Do NOT generalize individual actions into institutional or governance blame
      unless clearly stated in the NEWS CONTEXT
    - Do NOT moralize or prescribe policy changes without evidence
    - Avoid generic integrity panic language
    
    OUTPUT REQUIREMENTS:
    - Natural, human tone (non-templated)
    - Clear analytical stance or conclusion
    - Optional debate trigger grounded in evidence
    - No summarization
    `;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      max_tokens: 160,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: userPrompt },
      ],
    });

    const tweetText = res.choices[0]?.message?.content
      ?.replace(/\n[ \t]+/g, "\n")
      ?.replace(/\n{3,}/g, "\n\n")
      ?.trim();

    if (!tweetText) {
      console.warn("⚠️ Empty GPT tweet generated");
      return null;
    }

    return tweetText;
  } catch (err) {
    console.error("GPT Tweet Generation Error:", err);
    return null;
  }
}
