// whatsappSender.js
//
// Sends generated tweet drafts to your WhatsApp for manual review instead
// of auto-posting. Uses Twilio's WhatsApp API.
//
// ── ONE-TIME SETUP (free, ~5 minutes) ──────────────────────────────────────
// 1. Sign up at https://www.twilio.com/try-twilio (free trial, no card
//    needed for sandbox use).
// 2. In the Twilio Console, go to Messaging > Try it out > Send a WhatsApp
//    message. This gives you a Sandbox number (usually +1 415 523 8886)
//    and a join code like "join <two-words>".
// 3. From YOUR WhatsApp, send that join code as a message to the Sandbox
//    number. This links your number to the sandbox — required once, and
//    needs to be redone if you don't message the sandbox for 72 hours
//    (session expires; production numbers don't have this limit).
// 4. Grab your Account SID and Auth Token from the Twilio Console dashboard.
// 5. Add to your .env file:
//      TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//      TWILIO_AUTH_TOKEN=your_auth_token_here
//      TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
//      TWILIO_WHATSAPP_TO=whatsapp:+91XXXXXXXXXX   (your own number, with country code)
// 6. npm install twilio
//
// Sandbox is free forever for personal/testing use like this. You only
// need a paid/approved WhatsApp Business number if you want to message
// OTHER people, not yourself.
// ─────────────────────────────────────────────────────────────────────────

import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM;
const TO = process.env.TWILIO_WHATSAPP_TO;

let client = null;
if (ACCOUNT_SID && AUTH_TOKEN) {
  client = twilio(ACCOUNT_SID, AUTH_TOKEN);
} else {
  console.log(
    "⚠️ Twilio credentials missing — WhatsApp draft sending is disabled. Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM / TWILIO_WHATSAPP_TO in .env.",
  );
}

/**
 * Sends a generated tweet draft to your WhatsApp for manual review.
 *
 * @param {Object} draft
 * @param {string} draft.source - "SK" | "CB" | "CA" etc.
 * @param {string} draft.headline - original article headline
 * @param {string} draft.tweetText - the generated tweet text
 * @param {string} [draft.articleUrl] - link to the source article
 * @param {string} [draft.imageUrl] - a PUBLIC image URL (Cloudinary/CDN URL,
 *   NOT a local temp file path — WhatsApp/Twilio can only fetch public URLs)
 * @returns {Promise<boolean>} true if sent successfully
 */
export async function sendTweetDraftToWhatsApp(draft) {
  if (!client || !FROM || !TO) {
    console.log(
      "⚠️ WhatsApp not configured — skipping send, draft was only logged to console.",
    );
    return false;
  }

  const {
    source = "?",
    headline = "",
    tweetText = "",
    articleUrl = "",
    imageUrl = null,
  } = draft;

  const charCount = tweetText.length;

  const messageBody = [
    `🐦 *New ${source} draft* (${charCount} chars)`,
    ``,
    `*Headline:* ${headline}`,
    ``,
    tweetText,
    ``,
    articleUrl ? `🔗 ${articleUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const messageOptions = {
      from: FROM,
      to: TO,
      body: messageBody,
    };

    // Twilio can only attach a PUBLICLY reachable URL as media — a local
    // temp file path (e.g. from downloadImageToTemp) will NOT work here.
    // Only pass imageUrl if it's a real public URL (Cloudinary etc).
    if (imageUrl && /^https?:\/\//.test(imageUrl)) {
      messageOptions.mediaUrl = [imageUrl];
    }

    await client.messages.create(messageOptions);
    console.log(`✅ Sent ${source} draft to WhatsApp for review`);
    return true;
  } catch (error) {
    console.log("⚠️ Failed to send WhatsApp draft:", error?.message || error);
    return false;
  }
}
