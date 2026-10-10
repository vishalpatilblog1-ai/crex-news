// whatsappSender.js
//
// Sends generated tweet drafts to your WhatsApp for manual review instead
// of auto-posting. Uses Twilio's WhatsApp API (sandbox).
//
// ── SETUP ───────────────────────────────────────────────────────────────────
// 1. Twilio Console > Messaging > Try it out > Send a WhatsApp message.
//    Sandbox number is usually +1 415 523 8886, with a join code like
//    "join <two-words>".
// 2. From YOUR WhatsApp, send the join code to the Sandbox number.
//    The join lapses after ~72h, so re-send it regularly.
// 3. The sandbox also has a 24h customer-service window: Twilio can only
//    send free-form messages within 24h of YOUR last message to the sandbox
//    number. Send "hi" at least once every 24h.
// 4. Env vars (.env locally / Railway in production):
//      TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//      TWILIO_AUTH_TOKEN=your_auth_token_here
//      TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
//      TWILIO_WHATSAPP_TO=whatsapp:+91XXXXXXXXXX
// 5. npm install twilio
//
// Common failure codes (these show up AFTER Twilio accepts the message):
//   63015 -> your number is not joined to the sandbox (send the join code)
//   63016 -> outside the 24h window (send "hi")
//   21910 -> FROM/TO not both "whatsapp:" prefixed
// ─────────────────────────────────────────────────────────────────────────────

import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM;
const TO = process.env.TWILIO_WHATSAPP_TO;

// How long to wait before checking final delivery status (ms).
// Twilio accepts first and fails async a few seconds later.
const STATUS_CHECK_DELAY_MS = 8000;

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
 * The tweet text is ALWAYS printed to the console first, so a failed
 * WhatsApp delivery never loses the draft (copy it from the Railway log).
 *
 * @param {Object} draft
 * @param {string} draft.source - "SK" | "CB" | "CA" etc.
 * @param {string} draft.headline - original article headline
 * @param {string} draft.tweetText - the generated tweet text
 * @param {string} [draft.articleUrl] - link to the source article
 * @param {string} [draft.imageUrl] - a PUBLIC image URL (Cloudinary/CDN URL,
 *   NOT a local temp file path — Twilio can only fetch public URLs)
 * @returns {Promise<boolean>} true if delivery was not rejected
 */
export async function sendTweetDraftToWhatsApp(draft) {
  const {
    source = "?",
    headline = "",
    tweetText = "",
    articleUrl = "",
    imageUrl = null,
    articleType = null,
    score = null,
    virality = null,
  } = draft;

  console.log(`🗂️ ARTICLE TYPE :: ${articleType ?? "n/a"}`);
  console.log(
    `📊 SIGNIFICANCE SCORE :: ${score ?? "n/a"} VIRALITY :: ${virality ?? "n/a"}`,
  );
  console.log(`📰 TWEET HEADLINE :: ${headline}`);
  console.log(`🟦 TWEET LINK :: ${articleUrl || "n/a"}`);

  // Always log the tweet so it can be copied manually if WhatsApp fails.
  console.log(
    `\n===== TWEET FOR MANUAL POST (${source}, ${tweetText.length} chars) =====\n${tweetText}\n===== END TWEET =====\n`,
  );

  if (!client || !FROM || !TO) {
    console.log(
      "⚠️ WhatsApp not configured — skipping send, draft was only logged to console.",
    );
    return false;
  }

  // Pure tweet only, ready to copy and paste into X
  const messageBody = tweetText;

  try {
    const messageOptions = {
      from: FROM,
      to: TO,
      body: messageBody,
    };

    // Twilio can only attach a PUBLICLY reachable URL as media — a local
    // temp file path (e.g. from downloadImageToTemp) will NOT work here.
    if (imageUrl && /^https?:\/\//.test(imageUrl)) {
      messageOptions.mediaUrl = [imageUrl];
    }

    const msg = await client.messages.create(messageOptions);

    // create() only means Twilio ACCEPTED the message. Delivery failures
    // (63015, 63016, ...) happen a few seconds later, so check final status.
    await new Promise((resolve) => setTimeout(resolve, STATUS_CHECK_DELAY_MS));

    let check = null;
    try {
      check = await client.messages(msg.sid).fetch();
    } catch (fetchError) {
      console.log(
        "⚠️ Could not verify WhatsApp delivery status:",
        fetchError?.message || fetchError,
      );
    }

    if (check && ["failed", "undelivered"].includes(check.status)) {
      console.log(
        `❌ WhatsApp ${source} draft ${check.status} — error ${check.errorCode}: ${check.errorMessage || ""}. Copy the tweet from the log above and post manually.`,
      );
      if (check.errorCode === 63015) {
        console.log("👉 Fix: send the sandbox join code from your WhatsApp.");
      } else if (check.errorCode === 63016) {
        console.log('👉 Fix: send "hi" to the sandbox number.');
      }
      return false;
    }

    console.log(
      `✅ Sent ${source} draft to WhatsApp (status: ${check?.status ?? "unknown"})`,
    );
    return true;
  } catch (error) {
    console.log(
      `❌ Failed to send WhatsApp ${source} draft:`,
      error?.code ? `${error.code} — ${error.message}` : error?.message || error,
      "\nCopy the tweet from the log above and post manually.",
    );
    return false;
  }
}
