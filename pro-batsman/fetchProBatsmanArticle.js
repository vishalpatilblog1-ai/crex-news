// fetchProBatsmanArticle.js
import fetch from "node-fetch";

export async function fetchProBatsmanArticle(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (NewsBot)",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ProBatsman article: ${res.status}`);
  }

  return res.text();
}
