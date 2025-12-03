import { createLogger } from "../../utils/logger.js";
import { saveState } from "../../utils/stateStoreCloud.js";
import { generateNewsTweet } from "../ai/aiNewsTweet.js";
import {
  fetchNewsPhotos,
  getLiveNewsList,
  getNewsDetailsByNewsId,
} from "../cricbuzzApi.js";
import { tweetNewsWithImage } from "../tweetNewsWithImage.js";
const BASE_URL = "https://static.cricbuzz.com";

const log = createLogger("prod");
export async function newsPollingLoop() {
  // const STATE = global.STATE;
  if (!global.STATE) {
    console.log("⚠️ global.STATE not ready yet. Skipping news polling.");
    return;
  }
  const STATE = global.STATE;
  log("newsPollingLoop:::::");
  console.log("newsPollingLoop:::::");

  try {
    const news = await getLiveNewsList();
    const latestNews = getTopNews(news);

    if (!latestNews) return;

    const latestNewsId = latestNews.id;

    console.log("latestNews:::", latestNews);
    log("latestNews:::", latestNews);

    const imageId = latestNews?.imageId || latestNews?.coverImage?.id;

    const imageUrl = `${BASE_URL}/a/img/v1/1080x608/i1/c${imageId}/i.jpg`;

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

    // await postTweet_web(tweetText);
    await tweetNewsWithImage(tweetText, imageUrl);
    console.log(`🟢 Posted NEWS tweet with IMAGE for ID ${latestNewsId}`);

    console.log(`🟢 Posted NEWS tweet for ID ${latestNewsId}`);

    STATE[newsKey] = true;
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
  // console.log("newsResponse::", JSON.stringify(newsResponse, null, 2));
  if (!newsResponse?.storyList) return null;

  for (const item of newsResponse.storyList) {
    if (item.story) return item.story;
  }
  return null;
}

// export function getStoryById(newsId, storyList) {
//   if (!storyList || !Array.isArray(storyList)) return null;

//   for (const item of storyList) {
//     if (item.story && item.story.id === newsId) {
//       return item.story;
//     }
//   }

//   return null; // not found
// }
