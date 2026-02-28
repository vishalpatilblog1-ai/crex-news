// testIEImageDecision.js

import { decideIEImageUsage } from "./indian-express/ieNewsPollingLoop.js";

async function run() {
  const imageUrl =
    // "https://images.indianexpress.com/2026/02/pakistan-cricket.jpg?w=450";
    "https://images.indianexpress.com/2026/02/rinku-singh-mother-father-express-photo-gajendra-yadav.jpg?w=450";

  console.log("Image URL:", imageUrl);

  const result = await decideIEImageUsage(imageUrl);

  console.log("Decision:", result);
}

run();
