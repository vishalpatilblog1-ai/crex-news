import "dotenv/config";
import fetch from "node-fetch";

async function run() {
  //   const url = "https://cricbuzz-cricket.p.rapidapi.com/mcenter/v1/live";
  const url = "https://cricbuzz-cricket.p.rapidapi.com/mcenter/v1/live";

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-rapidapi-key": process.env.RAPIDAPI_KEY,
        "x-rapidapi-host": "cricbuzz-cricket.p.rapidapi.com",
      },
    });

    const text = await response.text();

    try {
      const json = JSON.parse(text);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.error("❌ Not JSON:", text);
    }
  } catch (e) {
    console.error("❌ Fetch error:", e);
  }
}

run();
