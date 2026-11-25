import twilio from "twilio";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

dotenv.config();

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM;
const TO = process.env.TWILIO_WHATSAPP_TO;

const SEND_VIA_TXT = ["true", "1", "yes", "on"].includes(
  String(process.env.SEND_VIA_TXT ?? "")
    .replace(/["']/g, "")
    .trim()
    .toLowerCase(),
);
console.log(
  `📎 SEND_VIA_TXT=${SEND_VIA_TXT} (raw: ${JSON.stringify(process.env.SEND_VIA_TXT)})`,
);

const STATUS_CHECK_DELAY_MS = 8000;
const TXT_STATUS_CHECK_DELAY_MS = 6000;

let client = null;
if (ACCOUNT_SID && AUTH_TOKEN) {
  client = twilio(ACCOUNT_SID, AUTH_TOKEN);
} else {
  console.log(
    "⚠️ Twilio credentials missing — WhatsApp draft sending is disabled. Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM / TWILIO_WHATSAPP_TO in .env.",
  );
}

const CLOUDINARY_READY = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET,
);
if (CLOUDINARY_READY) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}
if (SEND_VIA_TXT && !CLOUDINARY_READY) {
  console.log(
    "⚠️ SEND_VIA_TXT is on but CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are missing — the PDF message will be skipped.",
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function dedupeParagraphs(text) {
  const seen = new Set();
  return String(text || "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p && !seen.has(p) && seen.add(p));
}

function buildTxtContent({ tweetText, headline, source, articleText }) {
  const paras = dedupeParagraphs(articleText);
  if (paras[0] === String(headline || "").trim()) paras.shift();
  const article = paras.join("\n\n");
  return [
    String(tweetText || "").trim(),
    "",
    "Please add enough spice and enough commentary so that the post looks original",
    "",
    `===== SOURCE ARTICLE (${source}) =====`,
    headline,
    "",
    article,
    "===== END ARTICLE =====",
    "",
  ].join("\n");
}

function toPdfSafeText(text) {
  return String(text || "")
    .replace(/₹/g, "Rs ")
    .replace(/[\u2010\u2011\u2012]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(
      /[^\x09\x0A\x0D\x20-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g,
      "?",
    );
}

async function buildPdfBuffer(content) {
  const { default: PDFDocument } = await import("pdfkit");
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.font("Helvetica").fontSize(11).text(toPdfSafeText(content), {
      lineGap: 3,
    });
    doc.end();
  });
}

async function uploadTxtToCloudinary(pdfBuffer, source, headline) {
  const safeSource =
    String(source || "src")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "") || "src";
  const slug =
    String(headline || "article")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "article";

  const result = await cloudinary.uploader.upload(
    `data:application/pdf;base64,${pdfBuffer.toString("base64")}`,
    {
      resource_type: "raw",
      public_id: `gp_articles/${safeSource}-${slug}-${Date.now()}.pdf`,
      overwrite: true,
    },
  );
  return result.secure_url;
}

async function sendTxtMessage({
  source,
  headline,
  tweetText,
  articleText,
  caption = null,
}) {
  if (!CLOUDINARY_READY) {
    console.log("⚠️ Skipping PDF message — Cloudinary env vars are missing.");
    return false;
  }

  const content = buildTxtContent({ tweetText, headline, source, articleText });
  const pdfBuffer = await buildPdfBuffer(content);
  const url = await uploadTxtToCloudinary(pdfBuffer, source, headline);
  console.log(`📎 Article PDF uploaded (${pdfBuffer.length} bytes): ${url}`);

  const msg = await client.messages.create({
    from: FROM,
    to: TO,
    body: caption || `📎 ${source} tweet + article (PDF)`,
    mediaUrl: [url],
  });

  await sleep(TXT_STATUS_CHECK_DELAY_MS);

  let check = null;
  try {
    check = await client.messages(msg.sid).fetch();
  } catch (fetchError) {
    console.log(
      "⚠️ Could not verify PDF delivery status:",
      fetchError?.message || fetchError,
    );
  }

  if (check && ["failed", "undelivered"].includes(check.status)) {
    console.log(
      `❌ WhatsApp ${source} PDF ${check.status} — error ${check.errorCode}: ${check.errorMessage || ""}. ${caption ? "Falling back to the plain tweet message." : "The tweet message was delivered; the full article is in the log above."}${
        check.errorCode === 63019
          ? " 63019 = Twilio could not download the file. Open the Cloudinary URL above in a browser; if it does not open as a PDF, allow PDF delivery in Cloudinary > Settings > Security."
          : ""
      }`,
    );
    return false;
  }

  console.log(
    `✅ Sent ${source} PDF to WhatsApp (status: ${check?.status ?? "unknown"})`,
  );
  return true;
}

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
    articleText = "",
    generator = "n/a",
  } = draft;

  console.log(`🗂️ ARTICLE TYPE :: ${articleType ?? "n/a"}`);
  console.log(
    `📊 SIGNIFICANCE SCORE :: ${score ?? "n/a"} VIRALITY :: ${virality ?? "n/a"}`,
  );
  console.log(`📰 TWEET HEADLINE :: ${headline}`);
  console.log(`🟦 TWEET LINK :: ${articleUrl || "n/a"}`);
  console.log(
    `\n===== SOURCE ARTICLE (${source}, ${articleText.length} chars) =====\n${articleText}\n===== END ARTICLE =====\n`,
  );

  console.log(
    `\n===== TWEET FOR MANUAL POST (${source}, ${tweetText.length} chars) =====\n${tweetText}\n===== END TWEET =====\n`,
  );

  if (!client || !FROM || !TO) {
    console.log(
      "⚠️ WhatsApp not configured — skipping send, draft was only logged to console.",
    );
    return false;
  }

  const messageBody = `${tweetText}\n\n[${score ?? "n/a"}][${source}] article:${articleText.length} | tweet:${tweetText.length} | generator: ${generator}`;

  let pdfTried = false;
  if (SEND_VIA_TXT && articleText && !imageUrl && messageBody.length <= 1000) {
    pdfTried = true;
    try {
      const ok = await sendTxtMessage({
        source,
        headline,
        tweetText,
        articleText,
        caption: messageBody,
      });
      if (ok) return true;
    } catch (e) {
      console.log(
        `❌ Single-message PDF failed for ${source}, sending plain tweet message:`,
        e?.code ? `${e.code} — ${e.message}` : e?.message || e,
      );
    }
  }

  try {
    const messageOptions = {
      from: FROM,
      to: TO,
      body: messageBody,
    };

    if (imageUrl && /^https?:\/\//.test(imageUrl)) {
      messageOptions.mediaUrl = [imageUrl];
    }

    const msg = await client.messages.create(messageOptions);

    await sleep(STATUS_CHECK_DELAY_MS);

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

    if (SEND_VIA_TXT && articleText && !pdfTried) {
      try {
        await sendTxtMessage({ source, headline, tweetText, articleText });
      } catch (txtError) {
        console.log(
          `❌ Failed to send ${source} PDF message:`,
          txtError?.code
            ? `${txtError.code} — ${txtError.message}`
            : txtError?.message || txtError,
          "\nThe tweet message was delivered; the full article is in the log above.",
        );
      }
    }

    return true;
  } catch (error) {
    console.log(
      `❌ Failed to send WhatsApp ${source} draft:`,
      error?.code
        ? `${error.code} — ${error.message}`
        : error?.message || error,
      "\nCopy the tweet from the log above and post manually.",
    );
    return false;
  }
}
