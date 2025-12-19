export async function generateIENewsTweet(title) {
  const prompt = `
  You are an international cricket desk editor.
  
  Rewrite the following cricket headline into a neutral, concise news update.
  
  Rules:
  - Max 240 characters
  - No emojis
  - No hashtags
  - No hype
  - Calm, factual tone
  - Do not speculate
  - Use only the information in the headline
  
  HEADLINE:
  ${title}
  
  Write ONLY the tweet text.
  `;

  // call OpenAI same way as BBC
}
