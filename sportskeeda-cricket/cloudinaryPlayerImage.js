import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Matches your actual Cloudinary structure: crex-players/india/<player-slug>/...
const PLAYER_FOLDER_PREFIX = "crex-players/india";

function slugifyPlayerName(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Looks up a random image from the given player's Cloudinary folder.
 * Returns the image's secure_url, or null if the player has no folder
 * or the folder is empty.
 */
export async function getPlayerImageUrl(playerName) {
  if (!playerName || !String(playerName).trim()) {
    return null;
  }

  const slug = slugifyPlayerName(playerName);
  const folderPrefix = `${PLAYER_FOLDER_PREFIX}/${slug}/`;

  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      prefix: folderPrefix,
      max_results: 30,
    });

    const resources = result?.resources || [];

    if (resources.length === 0) {
      console.log(
        `ℹ️ No Cloudinary images found for player folder: ${folderPrefix}`,
      );
      return null;
    }

    const picked = resources[Math.floor(Math.random() * resources.length)];
    console.log(
      `🖼️ Found ${resources.length} Cloudinary image(s) for "${playerName}", using: ${picked.public_id}`,
    );
    return picked.secure_url;
  } catch (error) {
    console.log(
      `⚠️ Cloudinary lookup failed for "${playerName}":`,
      error?.message || error,
    );
    return null;
  }
}
