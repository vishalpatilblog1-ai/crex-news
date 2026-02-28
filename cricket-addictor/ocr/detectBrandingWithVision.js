// detectBrandingWithVision.js

import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Optional: simple timeout wrapper
function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Vision timeout")), ms)
    ),
  ]);
}

export async function detectBrandingWithVision(imagePath) {
  try {
    if (!imagePath || !fs.existsSync(imagePath)) {
      return { hasBranding: false, reason: "INVALID_IMAGE_PATH" };
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");

    const prompt = `
Analyze this image carefully.

Does it contain ANY of the following:
- News publisher logo
- Editorial watermark
- LIVE badge
- Broadcast graphics
- Channel branding
- News overlay banners
- Red circular Indian Express logo

Ignore:
- Player jerseys
- Stadium ads
- Normal background objects

Answer strictly with:
YES
or
NO
Do not explain.
`;

    const result = await withTimeout(
      model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        },
      ])
    );

    const text =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text
        ?.trim()
        ?.toUpperCase() || "";

    if (text.includes("YES")) {
      return { hasBranding: true, reason: "VISION_BRANDING_DETECTED" };
    }

    if (text.includes("NO")) {
      return { hasBranding: false, reason: "VISION_CLEAN" };
    }

    return {
      hasBranding: false,
      reason: "VISION_UNCLEAR_DEFAULT_ALLOW",
    };
  } catch (err) {
    console.warn("⚠️ Vision detection failed:", err.message);

    // Fail-safe: allow image if Vision fails
    return {
      hasBranding: false,
      reason: "VISION_ERROR_DEFAULT_ALLOW",
    };
  }
}
