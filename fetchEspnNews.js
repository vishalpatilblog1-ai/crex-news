// fetchEspnNews.js
import fetch from "node-fetch";

async function getEspnNews() {
  const url =
    "https://site.web.api.espncricinfo.com/apis/v2/pages/news?lang=en";

  try {
    console.log("🔎 Fetching ESPN Cricinfo News...");

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      console.error("❌ Failed:", response.status, response.statusText);
      return;
    }

    const data = await response.json();

    console.log("📰 Top Headlines:");
    console.log("-------------------------");

    const articles = data?.content?.news?.items || [];

    if (!articles.length) {
      console.log("⚠️ No articles found.");
      return;
    }

    articles.slice(0, 10).forEach((item, index) => {
      console.log(`${index + 1}. ${item.headline}`);
    });

    console.log("\n✅ Fetch complete.");
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}

getEspnNews();
