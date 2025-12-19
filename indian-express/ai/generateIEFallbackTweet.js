export function generateIEFallbackTweet(article) {
  const title = article?.title?.trim() || "Latest cricket update";
  const pubDate = article?.pubDate || "";

  return `${title}
    
    More details to follow from IE Sport.`;
}
