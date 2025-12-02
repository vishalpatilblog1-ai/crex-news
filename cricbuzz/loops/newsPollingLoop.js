import { postTweet_web } from "../../twitter.js";
import { saveState } from "../../utils/stateStoreCloud.js";
import { generateNewsTweet } from "../ai/aiNewsTweet.js";
import { getLiveNewsList, getNewsDetailsByNewsId } from "../cricbuzzApi.js";

export async function newsPollingLoop() {
  const STATE = global.STATE;
  console.log("newsPollingLoop:::::");
  console.log("newsPollingLoop STATE:::::", STATE);

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

    STATE[newsKey] = true;
    saveState(STATE);

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

    STATE[newsKey] = true; // backup
    await saveState(STATE);
    console.log("💾 State saved to JSONBin successfully");
  } catch (err) {
    console.error("❌ ERROR in newsPollingLoop:", err);
  }
}

function buildFullArticleText(detailNews) {
  if (!detailNews?.content) return "";

  return detailNews.content
    .filter((block) => block.content?.contentType === "text")
    .map((block) => block.content.contentValue)
    .join(" ");
}
function getTopNews(newsResponse) {
  if (!newsResponse?.storyList) return null;

  for (const item of newsResponse.storyList) {
    if (item.story) return item.story;
  }
  return null;
}
