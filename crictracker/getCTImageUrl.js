export function getCTImageUrl(item) {
  const html = item["content:encoded"];
  if (!html) return null;

  const match = html.match(/<img[^>]+src="([^">]+)"/i);
  return match?.[1] || null;
}
