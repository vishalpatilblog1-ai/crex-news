// uploadBreakingPlaceholder.js

import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Resolve path based on THIS FILE location
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_IMAGE = path.resolve(
  __dirname,
  "../../images/gully_point_default_match_result.webp"
);

async function upload() {
  try {
    console.log("Resolved path:", LOCAL_IMAGE);

    const result = await cloudinary.uploader.upload(LOCAL_IMAGE, {
      folder: "gp_placeholders",
      public_id: "gully_point_default_match_result",
      overwrite: true,
    });

    console.log("Uploaded URL:", result.secure_url);
  } catch (err) {
    console.error("Upload failed:", err);
  }
}

upload();
