export function getNDTVImageUrl(item) {
  const thumb = item?.["media:thumbnail"];
  const content = item?.["media:content"];

  const thumbUrl = Array.isArray(thumb) ? thumb?.[0]?.url : thumb?.url;
  const contentUrl = Array.isArray(content) ? content?.[0]?.url : content?.url;

  return contentUrl || thumbUrl || null;
}
