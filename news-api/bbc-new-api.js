import Parser from "rss-parser";

const parser = new Parser();

export async function fetchBBCCricketNews() {
  const feed = await parser.parseURL(
    "https://feeds.bbci.co.uk/sport/cricket/rss.xml"
  );

  return feed.items.map((item) => ({
    title: item.title,
    url: item.link,
    publishedAt: new Date(item.pubDate).toISOString(),
    summary: item.contentSnippet,
    source: "BBC Sport",
  }));
}
fetchBBCCricketNews().then((news) => {
  console.log(news[0]);
});
