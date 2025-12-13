import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.NEWS_API_KEY;

async function fetchNews() {
  const url = new URL("https://newsapi.org/v2/everything");

  url.searchParams.set("q", "cricket");
  url.searchParams.set("language", "en");
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("apiKey", API_KEY);

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "ok") {
    throw new Error(data.message);
  }

  return data.articles;
}

fetchNews().then(console.log);
