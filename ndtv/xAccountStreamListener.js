// xAccountStreamListener.js
import WebSocket from "ws";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.TWITTERAPI_IO_KEY; // your key here
const MONITOR_HANDLES = [
  "vikrantgupta73",
  "BCCI",
  "ashwinravi99",
  "gullypointnow_",
];

async function addMonitorRule() {
  try {
    const res = await axios.post(
      "https://api.twitterapi.io/oapi/tweet_filter/add_rule",
      {
        tag: "gullypoint_watchlist",
        value: MONITOR_HANDLES.map((h) => `from:${h}`).join(" OR "),
        interval_seconds: 5, // how often their backend checks, not your polling
      },
      { headers: { "X-API-Key": API_KEY } },
    );
    console.log("Monitor rule active:", res.data);
    return res.data;
  } catch (err) {
    console.error(
      "Failed to add monitor rule:",
      err.response?.data || err.message,
    );
  }
}

let reconnectDelay = 1000;

function connectStream() {
  const ws = new WebSocket(
    "wss://ws.twitterapi.io/twitter/tweet/websocket",
    { headers: { "x-api-key": API_KEY } }, // auth via header, not query param
  );

  ws.on("open", () => {
    console.log("Stream connected, watching:", MONITOR_HANDLES.join(", "));
    reconnectDelay = 1000; // reset backoff on successful connect
  });

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.event_type === "connected") {
      console.log("Handshake confirmed");
      return;
    }
    if (msg.event_type === "ping") {
      return; // keepalive, no action needed
    }

    // A real matched tweet came through
    if (msg.event_type === "tweet" && msg.tweet) {
      await handleIncomingTweet(msg.tweet);
    }
  });

  ws.on("close", () => {
    console.warn(`Stream closed. Reconnecting in ${reconnectDelay}ms...`);
    setTimeout(connectStream, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000); // exponential backoff, cap 30s
  });

  ws.on("error", (err) => {
    console.error("Stream error:", err.message);
    ws.close(); // triggers reconnect via 'close' handler
  });
}

// STEP 3 — Hand off to your existing pipeline (classify → gate → generate → card → post)
async function handleIncomingTweet(tweet) {
  console.log(`New tweet from @${tweet.author.userName}: ${tweet.text}`);
  // Plug in your existing functions here — same three-step pattern as caNewsPollingLoop.js
  // const classified = await classifyArticle({ text: tweet.text, source: 'x_account', author: tweet.author.userName });
  // if (!classified || classified.type === 'non_cricket') return; // your Kapil Dev-style gate
  // if (!passesSignificanceGate(classified)) return;
  // const generatedTweet = await generateTweet(classified);
  // await postToGullyPoint(generatedTweet);
}

// Boot sequence
(async () => {
  await addMonitorRule();
  connectStream();
})();
