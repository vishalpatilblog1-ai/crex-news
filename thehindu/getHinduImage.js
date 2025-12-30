export function getHinduImageUrl(item) {
  const media = item?.["media:content"];

  if (!media) return null;

  // xml2js may give object or array
  if (Array.isArray(media)) {
    return media[0]?.url || null;
  }

  return media.url || null;
}
