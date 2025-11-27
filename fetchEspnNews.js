import fetch from "node-fetch";

const urls = [
  "https://hs-consumer-api.espncricinfo.com/v1/pages/news",
  "https://site.api.espncricinfo.com/feed/cricket/news",
  "https://site.web.api.espncricinfo.com/apis/v2/pages/news?lang=en",
];

async function testUrls() {
  for (const url of urls) {
    console.log(`\n🌐 Trying: ${url}`);

    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0",
          accept: "application/json",
        },
      });

      console.log("Status:", res.status);

      if (!res.ok) {
        console.log("❌ Failed:", res.statusText);
        continue;
      }

      const text = await res.text();
      console.log("📄 First 500 chars:\n", text.slice(0, 500));
    } catch (e) {
      console.log("❌ ERROR:", e.message);
    }
  }
}

testUrls();
