// temp-debug-fetchCARSS.js
// Run this directly to inspect the raw shape of items returned by fetchCARSS(),
// specifically to check which field actually holds the RSS <title> text
// (item.headline vs item.title vs something else).

import { fetchCARSS } from "../cricket-addictor/fetchCARss.js";

// import { fetchCARSS } from "./cricket-addictor/fetchCARss.js";

async function main() {
  try {
    const items = await fetchCARSS();

    console.log("=== Total items returned ===");
    console.log(Array.isArray(items) ? items.length : "NOT AN ARRAY");

    if (!Array.isArray(items) || items.length === 0) {
      console.log("No items returned — nothing to inspect.");
      return;
    }

    console.log("\n=== First item — FULL raw object ===");
    console.log(JSON.stringify(items[0], null, 2));

    console.log("\n=== First item — key checks ===");
    console.log("item.headline:", items[0].headline);
    console.log("item.title:", items[0].title);
    console.log("item.link:", items[0].link);

    console.log("\n=== All items — headline/title field summary ===");
    items.forEach((item, i) => {
      console.log(`[${i}] headline="${item.headline}" | title="${item.title}"`);
    });
  } catch (err) {
    console.error("❌ fetchCARSS() failed:", err);
  }
}

main();
