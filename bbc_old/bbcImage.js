// bbcImage.js
export function getBBCImage(item) {
  const thumb = item["media:thumbnail"]?.url;
  if (!thumb) return null;

  // upgrade resolution: 240 → 1024
  return thumb.replace("/240/", "/1024/");
}
