import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";

export async function extractTextFromImage(imagePath) {
  const {
    data: { text },
  } = await Tesseract.recognize(imagePath, "eng", {
    logger: () => {},
  });

  return text || "";
}
