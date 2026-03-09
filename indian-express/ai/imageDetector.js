import sharp from "sharp";
import fs from "fs";
import axios from "axios";
import path from "path";
import os from "os";

export async function isBadCrop(imageUrl) {
  try {
    const tempPath = path.join(os.tmpdir(), `hindu-${Date.now()}.jpg`);

    const res = await axios({
      url: imageUrl,
      responseType: "arraybuffer",
    });

    fs.writeFileSync(tempPath, res.data);

    const meta = await sharp(tempPath).metadata();
    const ratio = meta.width / meta.height;

    fs.unlinkSync(tempPath);

    if (ratio > 2 || ratio < 0.7) {
      return true;
    }

    return false;
  } catch (err) {
    console.warn("⚠️ Crop check failed:", err.message);
    return false;
  }
}

export function normalizeHinduImageUrl(imageUrl) {
  if (!imageUrl) return null;

  return imageUrl.replace("LANDSCAPE_", "FREE_");
}
