// ie/fetchIEArticle.js
import fetch from "node-fetch";

export async function fetchIEArticle(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (CREX-NewsBot)",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch IE article: ${res.status}`);
  }

  return await res.text();
}
