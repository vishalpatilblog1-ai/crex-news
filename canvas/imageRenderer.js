import fs from "fs";
import path from "path";
import {
  renderNewsCardImage,
  saveGeneratedImage,
} from "./renderNewsCardImage.js";

const fontPathBold = path.join(process.cwd(), "fonts", "Inter_28pt-Bold.ttf");
const fontPathRegular = path.join(
  process.cwd(),
  "fonts",
  "Inter_28pt-Regular.ttf"
);

function areFontsAvailable() {
  return fs.existsSync(fontPathBold) && fs.existsSync(fontPathRegular);
}

export async function generateCardImage(baseImage, card) {
  try {
    if (!areFontsAvailable()) {
      console.log("❌ Fonts missing — fallback to text-only");
      return null;
    }

    const buffer = await renderNewsCardImage(baseImage, card);
    return saveGeneratedImage(buffer);
  } catch (err) {
    console.error("❌ Image generation failed:", err);
    return null;
  }
}
