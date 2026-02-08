export function buildDiscoveryPrompt({ nowUtc, windowHours }) {
  const windowMinutes = windowHours * 60;

  return `
You are a real-time CRICKET news discovery agent.

Current time (UTC): ${nowUtc}

Find ONLY news related to the ICC Men’s T20 World Cup 2026.
Return ONLY articles published within the last ${windowMinutes} minutes.
Ignore previews, opinions, image galleries, and non-article pages.
Respond strictly as JSON with sourceUrl and publishedAt.
`.trim();
}
