// getProBatsmanImage.js
export function getProBatsmanImageUrl(item) {
  // Prefer content:encoded
  const html = item?.["content:encoded"] || item?.description || "";

  const match = html.match(/<img[^>]+src="([^">]+)"/i);
  return match ? match[1] : null;
}
