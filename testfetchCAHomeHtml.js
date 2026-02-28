// testIEImageDecision.js

import { decideIEImageUsage } from "./indian-express/ieNewsPollingLoop.js";

async function run() {
  const imageUrl =
    "https://indianexpress.com/wp-content/uploads/2026/02/rinku-singh-mother-father-express-photo-gajendra-yadav.jpg";

  console.log("Image URL:", imageUrl);

  const result = await decideIEImageUsage(imageUrl);

  console.log("Decision:", result);
}

run();
