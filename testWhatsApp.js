// testWhatsApp.js
// Put this file in the project root (same folder as package.json and index.js),
// then run:  node testWhatsApp.js

import { sendTweetDraftToWhatsApp } from "./utils/whatsappSender.js";

// import { sendTweetDraftToWhatsApp } from "./utils/whatsappSender.js";

const ok = await sendTweetDraftToWhatsApp({
  source: "CA",
  headline: "Test headline",
  tweetText: "WhatsApp test message from crex-news.",
  articleUrl: "",
});

console.log("Sent:", ok);
