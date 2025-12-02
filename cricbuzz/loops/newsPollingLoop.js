import { postTweet_web } from "../../twitter.js";
import { loadState, saveState } from "../../utils/stateStore.js";
import { generateNewsTweet } from "../ai/aiNewsTweet.js";
import { getLiveNewsList, getNewsDetailsByNewsId } from "../cricbuzzApi.js";

let STATE = loadState();

export async function newsPollingLoop() {
  console.log("newsPollingLoop:::::");
  try {
    const news = await getLiveNewsList();
    const latestNews = getTopNews(news);

    if (!latestNews) return;
    const latestNewsId = latestNews.id;

    const newsKey = `news_${latestNewsId}`;
    if (STATE[newsKey]) {
      console.log(`🟡 News already tweeted: ${latestNewsId}`);
      return;
    }

    const detailNews = await getNewsDetailsByNewsId(latestNewsId);
    if (!detailNews) {
      console.log("⚠ No detailNews found");
      return;
    }

    const fullText = buildFullArticleText(detailNews);

    const tweetText = await generateNewsTweet(
      latestNews.hline,
      latestNews.intro,
      fullText
    );

    console.log("📝 News Tweet Preview:\n", tweetText);

    await postTweet_web(tweetText);

    console.log(`🟢 Posted NEWS tweet for ID ${latestNewsId}`);

    // 7. Mark as posted
    STATE[newsKey] = true;
    saveState(STATE);
  } catch (err) {
    console.error("❌ ERROR in newsPollingLoop:", err);
  }
}

function buildFullArticleText(detailNews) {
  if (!detailNews?.content) return "";

  const fullArticleText = detailNews.content
    .filter((block) => block.content?.contentType === "text")
    .map((block) => block.content.contentValue)
    .join(" ");

  return fullArticleText;
}
function getTopNews(newsResponse, limit = 1) {
  if (!newsResponse?.storyList) return null;

  for (const item of newsResponse.storyList) {
    if (item.story) return item.story;
  }

  return null;
}
