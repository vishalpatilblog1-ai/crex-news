// twitter.js
import { TwitterApi } from "twitter-api-v2";
import dotenv from "dotenv";
import axios from "axios";
import fs from "fs";
import path from "path";
import { createLogger } from "../utils/logger.js";
import { downloadNDTVImage } from "../ndtv/downloadNDTVImage.js";

dotenv.config();
const log = createLogger("prod");

export const twitterClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
});

const rwClient = twitterClient.readWrite;

// commented temporary. dont delete it.
// async function downloadImage(url) {
//   fs.mkdirSync("./tmp", { recursive: true });
//   const filePath = "./tmp/news.jpg";

//   const res = await axios.get(url, {
//     responseType: "arraybuffer",
//     headers: {
//       "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
//       "X-RapidAPI-Host": "cricbuzz-cricket.p.rapidapi.com",
//     },
//   });

//   fs.writeFileSync(filePath, res.data);
//   return filePath;
// }

// async function downloadImageGP(urlOrPath) {
//   fs.mkdirSync("./tmp", { recursive: true });

//   if (urlOrPath.startsWith("./") || urlOrPath.startsWith("/")) {
//     console.log("📁 Using local generated image");

//     return urlOrPath;
//   }

//   const filePath = "./tmp/news.jpg";

//   const res = await axios.get(urlOrPath, {
//     responseType: "arraybuffer",
//   });

//   fs.writeFileSync(filePath, res.data);
//   return filePath;
// }

export async function downloadImageGP(urlOrPath) {
  const TMP_DIR = "./tmp";
  fs.mkdirSync(TMP_DIR, { recursive: true });

  // ✅ LOCAL FILE (generated image)
  if (urlOrPath.startsWith("./") || urlOrPath.startsWith("/")) {
    const absolutePath = path.resolve(urlOrPath);

    console.log("📁 Using local generated image:", absolutePath);

    return {
      path: absolutePath,
      isLocal: true,
    };
  }

  // 🌐 REMOTE IMAGE
  try {
    const filePath = path.join(
      TMP_DIR,
      `news-${Date.now()}.jpg` // 🔥 avoid overwrite
    );

    const res = await axios.get(urlOrPath, {
      responseType: "arraybuffer",
    });

    fs.writeFileSync(filePath, res.data);

    console.log("⬇️ Downloaded remote image:", filePath);

    return {
      path: path.resolve(filePath),
      isLocal: false,
    };
  } catch (err) {
    console.warn("⚠️ Image download failed:", err.message);

    return {
      path: null,
      isLocal: false,
    };
  }
}

export async function tweetNewsWithImage(text, imageUrl, source) {
  let downloadedPath = null;
  let isLocal = false;

  try {
    const EXPERIMENT_TAGS = [];
    let finalText = text;

    const missingTags = EXPERIMENT_TAGS.filter(
      (tag) => !finalText.includes(tag)
    );

    if (missingTags.length > 0) {
      finalText += `\n\n${missingTags.join(" ")}`;
    }

    console.log("⬇ Downloading image...", source);

    try {
      const result = await downloadImageGP(imageUrl);
      downloadedPath = result.path;
      isLocal = result.isLocal;
    } catch (err) {
      console.warn(
        "⚠️ Image download failed, tweeting text only:",
        err.message
      );
    }

    if (downloadedPath && fs.existsSync(downloadedPath)) {
      console.log("📤 Uploading image to Twitter...");

      const data = fs.readFileSync(downloadedPath);

      const mediaId = await rwClient.v1.uploadMedia(data, {
        mimeType: "image/png",
      });

      console.log("📝 Tweeting with image...");
      const tweet = await rwClient.v2.tweet({
        text: finalText,
        media: { media_ids: [mediaId] },
      });

      console.log("🚀 Tweet Posted:", tweet.data.id);

      return tweet;
    }

    console.log("📝 Tweeting text only...");
    const tweet = await rwClient.v2.tweet({
      text: finalText,
    });

    console.log("🚀 Tweet Posted:", tweet.data.id);

    return tweet;
  } catch (err) {
    console.error("❌ Error tweeting news:", err);
    throw err;
  } finally {
    if (!isLocal && downloadedPath && fs.existsSync(downloadedPath)) {
      fs.unlinkSync(downloadedPath);
      console.log("🧹 Temp image deleted:", downloadedPath);
    }
  }
}
// export async function tweetNewsWithImage(text, imageUrl, source) {
//   try {
//     const EXPERIMENT_TAGS = [];

//     let finalText = text;

//     const missingTags = EXPERIMENT_TAGS.filter(
//       (tag) => !finalText.includes(tag)
//     );

//     if (missingTags.length > 0) {
//       finalText += `\n\n${missingTags.join(" ")}`;
//     }

//     console.log("⬇ Downloading image...", source);

//     let downloadedPath = null;

//     try {
//       downloadedPath = await downloadImageGP(imageUrl);
//       // if (source === "NDTV") {
//       //   downloadedPath = await downloadNDTVImage(imageUrl);
//       // } else {
//       //   downloadedPath = await downloadImageGP(imageUrl);
//       // }
//     } catch (err) {
//       console.warn(
//         "⚠️ Image download failed, tweeting text only:",
//         err.message
//       );
//     }

//     // IMAGE SUCCESS
//     if (downloadedPath) {
//       console.log("📤 Uploading image to Twitter...");
//       const data = fs.readFileSync(downloadedPath);

//       const mediaId = await rwClient.v1.uploadMedia(data, {
//         mimeType: "image/jpeg",
//       });

//       console.log("📝 Tweeting with image...");
//       const tweet = await rwClient.v2.tweet({
//         text: finalText,
//         media: { media_ids: [mediaId] },
//       });

//       console.log("🚀 Tweet Posted:", tweet.data.id);

//       fs.unlinkSync(downloadedPath);
//       return tweet;
//     }

//     // FALLBACK TEXT TWEET
//     console.log("📝 Tweeting text only (image unavailable)...");
//     const tweet = await rwClient.v2.tweet({
//       text: finalText,
//     });

//     console.log("🚀 Tweet Posted:", tweet.data.id);

//     return tweet;
//   } catch (err) {
//     console.error("❌ Error tweeting news:", err);
//   }
// }

// export async function tweetNewsWithImage(text, imageUrl, source) {
//   try {
//     const EXPERIMENT_TAGS = [];

//     let finalText = text;

//     const missingTags = EXPERIMENT_TAGS.filter(
//       (tag) => !finalText.includes(tag)
//     );

//     if (missingTags.length > 0) {
//       finalText += `\n\n${missingTags.join(" ")}`;
//     }
//     console.log("⬇ Downloading image...", source);

//     let downloadedPath;

//     if (source === "NDTV") {
//       downloadedPath = await downloadNDTVImage(imageUrl);
//     } else {
//       downloadedPath = await downloadImage(imageUrl); // default
//     }
//     // const downloadedPath = await downloadImage(imageUrl);

//     console.log("📤 Uploading image to Twitter...");
//     const data = fs.readFileSync(downloadedPath);
//     const mediaId = await rwClient.v1.uploadMedia(data, {
//       mimeType: "image/jpeg",
//     });

//     console.log("📝 Tweeting...");
//     const tweet = await rwClient.v2.tweet({
//       text: finalText,
//       media: { media_ids: [mediaId] },
//     });

//     console.log("🚀 Tweet Posted:", tweet.data.id);

//     fs.unlinkSync(downloadedPath);
//     return tweet;
//   } catch (err) {
//     console.error("❌ Error tweeting news image:", err);
//   }
// }

export async function tweetNewsWithoutImage(payload) {
  try {
    const text = typeof payload === "string" ? payload : payload?.text;
    const media_ids = payload?.media_ids;
    const replyTo = payload?.replyTo;

    if (typeof text !== "string") {
      log("❌ Invalid tweet (not a string)");
      console.log("INVALID TWEET:", payload);
      return null;
    }

    if (!text.trim()) {
      log("⚠ Empty tweet skipped");
      return null;
    }

    const tweetPayload = {
      text,
      ...(media_ids?.length ? { media: { media_ids } } : {}),
      ...(replyTo ? { reply: { in_reply_to_tweet_id: replyTo } } : {}),
    };

    const res = await twitterClient.v2.tweet(tweetPayload);

    log("📤 Tweet POSTED via API:");
    log(JSON.stringify(res.data, null, 2));

    return res.data;
  } catch (err) {
    log("❌ Error posting tweet (API):");
    console.error(err);
    return null;
  }
}

export async function postTweet_bbc_console(payload) {
  const text = typeof payload === "string" ? payload : payload?.text;

  if (typeof text !== "string") {
    console.log("❌ Invalid tweet (not a string)");
    console.log("INVALID TWEET:", payload);
    return null;
  }

  if (!text.trim()) {
    console.log("⚠ Empty tweet skipped (console mode)");
    return null;
  }

  console.log(`\n\n${text}\n\n`);

  return {
    id: `console_${Date.now()}`,
  };
}

export async function postTweet_console(text) {
  if (typeof text !== "string") {
    log("❌ Invalid tweet (not a string)");
    console.log("INVALID TWEET:", text);
    return;
  }

  if (!text.trim()) {
    log("⚠ Empty tweet skipped (console mode)");
    return;
  }

  // console.log("=============================");
  console.log("🟦 AI PROD TWEET (CONSOLE MODE):");
  console.log(`

${text}
  
  `);
  // console.log("=============================");

  return { status: "console_ok", text };
}

// export async function postTweet_ie_web(payload) {
//   try {
//     const text = typeof payload === "string" ? payload : payload?.text;
//     const media_ids = payload?.media_ids;
//     const replyTo = payload?.replyTo;

//     if (typeof text !== "string") {
//       log("❌ Invalid tweet (not a string)");
//       console.log("INVALID TWEET:", payload);
//       return null;
//     }

//     if (!text.trim()) {
//       log("⚠ Empty tweet skipped");
//       return null;
//     }

//     const tweetPayload = {
//       text,
//       ...(media_ids?.length ? { media: { media_ids } } : {}),
//       ...(replyTo ? { reply: { in_reply_to_tweet_id: replyTo } } : {}),
//     };

//     const res = await twitterClient.v2.tweet(tweetPayload);

//     log("📤 Tweet POSTED via API:");
//     log(JSON.stringify(res.data, null, 2));

//     return res.data;
//   } catch (err) {
//     log("❌ Error posting tweet (API):");
//     console.error(err);
//     return null;
//   }
// }

// export async function postTweet_ie_web(payload) {
//   try {
//     const text = typeof payload === "string" ? payload : payload?.text;
//     const media_ids = payload?.media_ids;

//     if (typeof text !== "string") {
//       log("❌ Invalid tweet (not a string)");
//       console.log("INVALID TWEET:", payload);
//       return null;
//     }

//     if (!text.trim()) {
//       log("⚠ Empty tweet skipped");
//       return null;
//     }

//     const res = await twitterClient.v2.tweet({
//       text,
//       ...(media_ids?.length ? { media: { media_ids } } : {}),
//     });

//     log("📤 Tweet POSTED via API:");
//     log(JSON.stringify(res.data, null, 2));

//     return res.data;
//   } catch (err) {
//     log("❌ Error posting tweet (API):");
//     console.error(err);
//     return null;
//   }
// }

export async function postTweet_bbc_web(payload) {
  try {
    const text = typeof payload === "string" ? payload : payload?.text;
    const media_ids = payload?.media_ids;

    if (typeof text !== "string") {
      log("❌ Invalid tweet (not a string)");
      console.log("INVALID TWEET:", payload);
      return null;
    }

    if (!text.trim()) {
      log("⚠ Empty tweet skipped");
      return null;
    }

    const res = await twitterClient.v2.tweet({
      text,
      ...(media_ids?.length ? { media: { media_ids } } : {}),
    });

    log("📤 Tweet POSTED via API:");
    log(JSON.stringify(res.data, null, 2));

    return res.data;
  } catch (err) {
    log("❌ Error posting tweet (API):");
    console.error(err);
    return null;
  }
}

export async function postTweet_web(text) {
  try {
    if (typeof text !== "string") {
      log("❌ Invalid tweet (not a string)");
      console.log("INVALID TWEET:", text);
      return;
    }

    if (!text.trim()) {
      log("⚠ Empty tweet skipped (console mode)");
      return;
    }

    const res = await twitterClient.v2.tweet(text);
    log("📤 Tweet POSTED via API:");
    log(JSON.stringify(res.data, null, 2));

    console.log("📤 Tweet POSTED via API:");
    console.log(JSON.stringify(res.data, null, 2));

    return res.data;
  } catch (err) {
    log("❌ Error posting tweet (API):");
    log(err);
  }
}

export async function quoteTweet(payload) {
  try {
    const text = payload?.text;
    const quoteTweetId = payload?.quoteTweetId;

    if (!text || !quoteTweetId) {
      console.log("❌ Invalid quote tweet payload:", payload);
      return null;
    }

    if (process.env.CONSOLE_ONLY === "true") {
      console.log("\n🧪 [QUOTE TWEET - CONSOLE MODE]");
      console.log("Text:\n", text);
      console.log("Quote Tweet ID:", quoteTweetId);
      console.log("👉 https://twitter.com/i/web/status/" + quoteTweetId);
      return { id: `console_${Date.now()}` };
    }

    const res = await twitterClient.v2.tweet({
      text,
      quote_tweet_id: quoteTweetId,
    });

    console.log("🚀 Quote Tweet Posted:", res.data.id);
    return res.data;
  } catch (err) {
    console.error("❌ Error in quoteTweet:", err);
    return null;
  }
}
