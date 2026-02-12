import Tesseract from "tesseract.js";
import { downloadImageToTemp } from "../cricket-addictor/ocr/downloadImageToTemp.js";

export async function isIEBrandedImage(imageUrl) {
  try {
    if (!imageUrl) return false;

    const filePath = await downloadImageToTemp(imageUrl);

    const { data } = await Tesseract.recognize(filePath, "eng");

    const text = data.text?.toLowerCase() || "";

    if (
      text.includes("indian express") ||
      text.includes("the indian express") ||
      text.includes("express @")
    ) {
      console.log("🟢 IE watermark detected");
      return true;
    }

    return false;
  } catch (err) {
    console.warn("⚠️ IE OCR failed:", err.message);
    return false;
  }
}
