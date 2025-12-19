//fetchBBCArticle.js
import fetch from "node-fetch";

export async function fetchBBCArticle(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (NewsBot)",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch article: ${res.status}`);
  }

  const html = await res.text();
  return html;
}
