// import { isRiskyTwitterImage } from "./detectTwitterReference.js";

import { isRiskyTwitterImage } from "./cricket-addictor/ocr/detectTwitterReference.js";

// const imagePath =
//   "https://cricketaddictor.com/images/posts/2026/AFG-vs-WI.jpg?q=80&width=500&height=282";
const imagePath =
  "https://cricketaddictor.com/images/posts/2026/TR-Glenn-Phillips.webp?q=80";

const result = await isRiskyTwitterImage(imagePath);

if (result.risky) {
  console.log("⚠️ Risky image detected:", result.reason);
  console.log("Extracted text:", result.extractedText);

  // ACTION OPTIONS:
  // 1. Skip image, post text-only
  // 2. Try alternate image
  // 3. Skip post entirely
} else {
  console.log("✅ Image safe to use");
}
