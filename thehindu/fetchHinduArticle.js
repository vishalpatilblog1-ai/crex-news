// fetchHinduArticle.js
import fetch from "node-fetch";

export async function fetchHinduArticle(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (NewsBot)",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Hindu article: ${res.status}`);
  }

  return res.text();
}
