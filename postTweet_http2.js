// postTweet_http2.js
import http2 from "http2";
import dotenv from "dotenv";
dotenv.config();

const X_COOKIE = process.env.X_COOKIE;
const X_CT0 = process.env.X_CT0;

// Twitter CreateTweet GraphQL Endpoint
const TWEET_URL =
  "https://x.com/i/api/graphql/TAJw1rBsjAtdNgTdlo2oeg/CreateTweet";

export async function postTweet_http2(text) {
  return new Promise((resolve, reject) => {
    const client = http2.connect("https://x.com");

    client.on("error", (err) => {
      console.error("HTTP/2 Connection Error:", err);
      return reject(err);
    });

    const req = client.request({
      ":method": "POST",
      ":path": "/i/api/graphql/TAJw1rBsjAtdNgTdlo2oeg/CreateTweet",
      "content-type": "application/json",
      authorization:
        "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
      "x-csrf-token": X_CT0,
      cookie: X_COOKIE,
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      accept: "*/*",
      origin: "https://x.com",
      referer: "https://x.com/compose/tweet",
    });

    const body = JSON.stringify({
      variables: {
        tweet_text: text,
        dark_request: false,
        media: {
          media_entities: [],
          possibly_sensitive: false,
        },
        semantic_annotation_ids: [],
      },
      features: {
        premium_content_api_read_enabled: false,
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        responsive_web_grok_analyze_button_fetch_trends_enabled: false,
        responsive_web_grok_analyze_post_followups_enabled: true,
        responsive_web_jetfuel_frame: true,
        responsive_web_grok_share_attachment_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false,
        responsive_web_grok_show_grok_translated_post: false,
        responsive_web_grok_analysis_button_from_backend: true,
        creator_subscriptions_quote_tweet_preview_enabled: false,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        profile_label_improvements_pcf_label_in_post_enabled: true,
        responsive_web_profile_redirect_enabled: false,
        rweb_tipjar_consumption_enabled: true,
        verified_phone_label_enabled: true,
        articles_preview_enabled: true,
        responsive_web_grok_community_note_auto_translation_is_enabled: false,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        responsive_web_grok_image_annotation_enabled: true,
        responsive_web_grok_imagine_annotation_enabled: true,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_enhance_cards_enabled: false,

        // ★ These two are also always in browser context:
        responsive_web_twitter_blue_verified_badge_is_enabled: true,
        responsive_web_twitter_blue_verified_label_enabled: true,
      },
      queryId: "TAJw1rBsjAtdNgTdlo2oeg",
    });

    req.setEncoding("utf8");

    let responseData = "";

    req.on("response", (headers) => {
      console.log("🔵 RESPONSE HEADERS:");
      console.log(headers);
    });

    req.on("data", (chunk) => {
      responseData += chunk;
    });

    req.on("end", () => {
      console.log("🟢 RAW RESPONSE BODY:");
      console.log(responseData);

      client.close();

      try {
        return resolve(JSON.parse(responseData));
      } catch (err) {
        return resolve(responseData);
      }
    });

    req.on("error", (err) => {
      console.error("❌ REQUEST ERROR:", err);
      client.close();
      return reject(err);
    });

    req.write(body);
    req.end();
  });
}
