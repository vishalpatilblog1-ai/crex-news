export function buildNewsPrompt(article) {
  return `
  You are a sports news editor.
  
  Rewrite the following BBC article into a short, neutral cricket news tweet.
  
  Rules:
  - Max 240 characters
  - Simple English
  - No emojis
  - No exaggeration
  - Neutral tone
  - Mention key fact only
  - Do NOT mention BBC in text
  
  ARTICLE:
  ${article.body}
  `;
}
