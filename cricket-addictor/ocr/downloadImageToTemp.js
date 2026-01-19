import fs from "fs";
import path from "path";
import fetch from "node-fetch";

export async function downloadImageToTemp(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Failed to download image");

  const buffer = await res.arrayBuffer();

  const tempDir = "/tmp";
  const fileName = `ocr_${Date.now()}.jpg`;
  const filePath = path.join(tempDir, fileName);

  fs.writeFileSync(filePath, Buffer.from(buffer));

  return filePath;
}
