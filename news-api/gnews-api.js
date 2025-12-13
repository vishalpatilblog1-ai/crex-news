import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.GNEWS_API_KEY;

async function fetchSportsNews() {
  const url = new URL("https://gnews.io/api/v4/top-headlines");

  url.searchParams.set("topic", "sports");
  url.searchParams.set("lang", "en");
  url.searchParams.set("country", "in");
  url.searchParams.set("max", "10");
  url.searchParams.set("apikey", API_KEY);

  const res = await fetch(url);
  const data = await res.json();
  console.log(data);

  return data.articles;
}

fetchSportsNews().then(console.log);
