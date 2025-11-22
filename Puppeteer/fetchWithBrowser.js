import { getBrowserPage } from "./browser.js";

export async function browserFetchJSON(url) {
  const page = await getBrowserPage();

  try {
    const response = await page.evaluate(async (url) => {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": navigator.userAgent,
          Accept: "application/json, text/plain, */*",
        },
      });

      const text = await res.text();
      return text;
    }, url);

    if (response.startsWith("<")) {
      console.log("❌ Browser fetch got HTML instead of JSON");
      console.log(response.slice(0, 200));
      return null;
    }

    return JSON.parse(response);
  } catch (e) {
    console.log("❌ Browser fetch error:", e.message);
    return null;
  }
}
