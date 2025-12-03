import axios from "axios";
import fs from "fs";
import { promisify } from "util";
import sizeOf from "image-size";
import dotenv from "dotenv";
import sharp from "sharp";
dotenv.config();

const writeFile = promisify(fs.writeFile);

export async function downloadAndCheckResolution(
  url,
  filename = "tmp_image.jpg"
) {
  try {
    console.log("⬇ Downloading:", url);

    const res = await axios.get(url, {
      responseType: "arraybuffer",
      headers: {
        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
        "X-RapidAPI-Host": "cricbuzz-cricket.p.rapidapi.com",
        "User-Agent": "Mozilla/5.0",
      },
    });

    const filePath = `./tmp/${filename}`;
    fs.mkdirSync("./tmp", { recursive: true });
    fs.writeFileSync(filePath, res.data);

    const metadata = await sharp(filePath).metadata();

    console.log("📸 Saved:", filePath);
    console.log("📏 Resolution:", metadata.width, "x", metadata.height);

    return metadata;
  } catch (err) {
    console.error("❌ Error:", err);
    return null;
  }
}

// await downloadAndCheckResolution(
//   "https://cricbuzz-cricket.p.rapidapi.com/img/v1/i1/c791108/i.jpg",
//   "test.jpg"
// );

await downloadAndCheckResolution(
  // "https://static.cricbuzz.com/a/img/v1/1080x608/i1/c791053/i.jpg",
  "https://static.cricbuzz.com/a/img/v1/1080x608/i1/c791108/i.jpg",
  "test4.jpg"
);
