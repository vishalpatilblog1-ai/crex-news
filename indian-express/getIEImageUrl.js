export function getIEImageUrl(item) {
  // xml2js may return objects or arrays depending on feed edge cases
  const thumb = item?.["media:thumbnail"];
  const content = item?.["media:content"];

  const thumbUrl = Array.isArray(thumb) ? thumb?.[0]?.url : thumb?.url;
  const contentUrl = Array.isArray(content) ? content?.[0]?.url : content?.url;

  return thumbUrl || contentUrl || null;
}
