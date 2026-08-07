// import axios from "axios";
// import * as cheerio from "cheerio";

// const SPORTSKEEDA_BASE_URL = "https://www.sportskeeda.com";

// const SK_CRICKET_URLS = [
//   "https://www.sportskeeda.com/cricket",
//   "https://www.sportskeeda.com/cricket/news",
// ];

// // const REQUEST_TIMEOUT_MS = Number(process.env.SK_REQUEST_TIMEOUT_MS || 20000);

// // const DATE_CONCURRENCY = Number(process.env.SK_DATE_CONCURRENCY || 5);

// // const DEBUG = process.env.SK_DEBUG === "true";

// // const USER_AGENTS = [
// //   "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
// //   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
// // ];

// const REQUEST_TIMEOUT_MS = Number(process.env.SK_REQUEST_TIMEOUT_MS || 30000);

// const DATE_CONCURRENCY = Number(process.env.SK_DATE_CONCURRENCY || 5);

// const DEBUG = process.env.SK_DEBUG === "true";

// // Railway's outbound IP range gets blocked directly by SportsKeeda's WAF
// // (confirmed: identical request + headers works fine from a local/residential
// // IP, fails only from Railway) -- so requests are routed through ScraperAPI
// // instead, which fetches on our behalf from IPs that aren't flagged as
// // datacenter/bot traffic. The old direct-fetch header spoofing (User-Agent,
// // Sec-Ch-Ua, Sec-Fetch-*) is no longer needed here -- ScraperAPI handles
// // browser-identity headers on their end. Get a key at scraperapi.com; it has
// // a free tier that should cover light polling volume before any paid plan
// // is needed.
// const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY;
// const SCRAPERAPI_ENDPOINT = "https://api.scraperapi.com";

// const GENERIC_HEADLINES = new Set([
//   "view all",
//   "view all news",
//   "read more",
//   "more news",
//   "latest news",
//   "see all",
//   "click here",
//   "load more",
//   "show more",
//   "top stories",
//   "latest",
//   "news",
//   "cricket news",
// ]);

// const BLOCKED_HEADLINE_WORDS = [
//   "dream11",
//   "fantasy tips",
//   "playing xi",
//   "pitch report",
//   "weather report",
//   "live score",
//   "live updates",
//   "scorecard",
//   "match prediction",
//   "betting tips",
//   "today's match",
//   "todays match",
// ];

// const BLOCKED_URL_PARTS = [
//   "/live-cricket-score",
//   "/cricket-schedule",
//   "/points-table",
//   "/cricket-rankings",
//   "/teams/",
//   "/players/",
//   "/photos/",
//   "/videos/",
//   "/web-stories/",
//   "/fantasy-cricket-mantra/",
// ];

// const NON_ARTICLE_PATHS = new Set([
//   "/cricket",
//   "/cricket/",
//   "/cricket/news",
//   "/cricket/news/",
//   "/cricket/schedule",
//   "/cricket/schedule/",
//   "/cricket/live-cricket-score",
//   "/cricket/live-cricket-score/",
//   "/cricket/points-table",
//   "/cricket/points-table/",
//   "/cricket/rankings",
//   "/cricket/rankings/",
//   "/cricket/teams",
//   "/cricket/teams/",
//   "/cricket/players",
//   "/cricket/players/",
// ]);

// const CARD_SELECTOR = [
//   "article",
//   "li",
//   "[class*='card']",
//   "[class*='Card']",
//   "[class*='story']",
//   "[class*='Story']",
//   "[class*='news']",
//   "[class*='News']",
//   "[class*='article']",
//   "[class*='Article']",
//   "[class*='listing']",
//   "[class*='Listing']",
//   "[class*='item']",
//   "[class*='Item']",
// ].join(", ");

// const HEADLINE_SELECTOR = [
//   "h1",
//   "h2",
//   "h3",
//   "h4",
//   "h5",
//   "[class*='headline']",
//   "[class*='Headline']",
//   "[class*='title']",
//   "[class*='Title']",
//   "[class*='heading']",
//   "[class*='Heading']",
// ].join(", ");

// const URL_ELEMENT_SELECTOR = [
//   "a[href]",
//   "[data-href]",
//   "[data-url]",
//   "[data-link]",
//   "[data-target-url]",
//   "[data-article-url]",
//   "[data-canonical-url]",
//   "[onclick]",
// ].join(", ");

// function cleanText(value = "") {
//   return String(value)
//     .replace(/\\n/g, " ")
//     .replace(/\\t/g, " ")
//     .replace(/\s+/g, " ")
//     .replace(/&nbsp;/gi, " ")
//     .trim();
// }

// function decodeHtmlText(value = "") {
//   return cleanText(
//     String(value)
//       .replace(/\\u002F/gi, "/")
//       .replace(/\\u003A/gi, ":")
//       .replace(/\\u0026/gi, "&")
//       .replace(/\\\//g, "/")
//       .replace(/\\"/g, '"')
//       .replace(/&quot;/gi, '"')
//       .replace(/&#34;/gi, '"')
//       .replace(/&#39;/gi, "'")
//       .replace(/&amp;/gi, "&"),
//   );
// }

// function makeAbsoluteUrl(value, baseUrl = SPORTSKEEDA_BASE_URL) {
//   if (!value) return null;

//   try {
//     return new URL(value, baseUrl).toString();
//   } catch {
//     return null;
//   }
// }

// function normalizeSKLink(value = "") {
//   const absoluteLink = makeAbsoluteUrl(
//     decodeHtmlText(value),
//     SPORTSKEEDA_BASE_URL,
//   );

//   if (!absoluteLink) return null;

//   try {
//     const url = new URL(absoluteLink);

//     if (
//       url.hostname !== "www.sportskeeda.com" &&
//       url.hostname !== "sportskeeda.com"
//     ) {
//       return null;
//     }

//     url.protocol = "https:";
//     url.hostname = "www.sportskeeda.com";
//     url.hash = "";

//     const removableParams = [
//       "utm_source",
//       "utm_medium",
//       "utm_campaign",
//       "utm_term",
//       "utm_content",
//       "fbclid",
//       "gclid",
//     ];

//     removableParams.forEach((param) => {
//       url.searchParams.delete(param);
//     });

//     let pathname = url.pathname.replace(/\/+/g, "/").replace(/\/$/, "");

//     if (!pathname) {
//       pathname = "/";
//     }

//     url.pathname = pathname;

//     return url.toString();
//   } catch {
//     return null;
//   }
// }

// function normalizePublishedAt(value) {
//   if (!value) return null;

//   const text = cleanText(value);

//   if (!text) return null;

//   const timestamp = Date.parse(text);

//   if (!Number.isFinite(timestamp)) {
//     return null;
//   }

//   return new Date(timestamp).toISOString();
// }

// function isGenericHeadline(value = "") {
//   const headline = cleanText(value).toLowerCase();

//   if (!headline) return true;

//   return GENERIC_HEADLINES.has(headline);
// }

// function isUsableHeadline(value = "") {
//   const headline = cleanText(value);

//   if (!headline) return false;
//   if (headline.length < 15) return false;
//   if (headline.length > 350) return false;
//   if (isGenericHeadline(headline)) return false;

//   const lowerHeadline = headline.toLowerCase();

//   if (
//     lowerHeadline.startsWith("view all") ||
//     lowerHeadline.startsWith("read more") ||
//     lowerHeadline === "sportskeeda"
//   ) {
//     return false;
//   }

//   return true;
// }

// function isBlockedHeadline(value = "") {
//   const headline = cleanText(value).toLowerCase();

//   return BLOCKED_HEADLINE_WORDS.some((word) => headline.includes(word));
// }

// function isSportskeedaCricketArticle(value = "") {
//   const normalizedLink = normalizeSKLink(value);

//   if (!normalizedLink) return false;

//   try {
//     const url = new URL(normalizedLink);
//     const pathname = url.pathname.toLowerCase();

//     if (!pathname.startsWith("/cricket/")) {
//       return false;
//     }

//     if (NON_ARTICLE_PATHS.has(pathname)) {
//       return false;
//     }

//     if (BLOCKED_URL_PARTS.some((part) => pathname.includes(part))) {
//       return false;
//     }

//     const pathParts = pathname.split("/").filter(Boolean);

//     if (pathParts.length < 2) {
//       return false;
//     }

//     return true;
//   } catch {
//     return false;
//   }
// }

// function extractUrlFromText(value = "", baseUrl = SPORTSKEEDA_BASE_URL) {
//   if (!value) return null;

//   const text = decodeHtmlText(value);

//   const absolutePatterns = [
//     /https?:\/\/(?:www\.)?sportskeeda\.com\/cricket\/[^\s"'<>\\)\]}]+/i,
//     /https?:\\?\/\\?\/(?:www\.)?sportskeeda\.com\\?\/cricket\\?\/[^\s"'<>\\)\]}]+/i,
//   ];

//   for (const pattern of absolutePatterns) {
//     const match = text.match(pattern);

//     if (match?.[0]) {
//       const link = normalizeSKLink(match[0]);

//       if (link) {
//         return link;
//       }
//     }
//   }

//   const relativePatterns = [
//     /\/cricket\/[^\s"'<>\\)\]}]+/i,
//     /\\\/cricket\\\/[^\s"'<>\\)\]}]+/i,
//   ];

//   for (const pattern of relativePatterns) {
//     const match = text.match(pattern);

//     if (match?.[0]) {
//       const relativeLink = match[0]
//         .replace(/\\\//g, "/")
//         .replace(/[),.;]+$/, "");

//       const absoluteLink = makeAbsoluteUrl(relativeLink, baseUrl);

//       const normalizedLink = normalizeSKLink(absoluteLink);

//       if (normalizedLink) {
//         return normalizedLink;
//       }
//     }
//   }

//   return null;
// }

// function getElementUrl($element, baseUrl) {
//   const urlAttributes = [
//     "href",
//     "data-href",
//     "data-url",
//     "data-link",
//     "data-target-url",
//     "data-article-url",
//     "data-canonical-url",
//     "onclick",
//   ];

//   for (const attribute of urlAttributes) {
//     const value = $element.attr(attribute);

//     if (!value) continue;

//     const extractedLink = extractUrlFromText(value, baseUrl);

//     if (extractedLink) {
//       return extractedLink;
//     }

//     if (attribute !== "onclick" && String(value).includes("/cricket/")) {
//       const absoluteLink = makeAbsoluteUrl(value, baseUrl);

//       const normalizedLink = normalizeSKLink(absoluteLink);

//       if (normalizedLink) {
//         return normalizedLink;
//       }
//     }
//   }

//   return null;
// }

// function findFirstUsableText($, elements) {
//   let result = "";

//   elements.each((_, element) => {
//     const text = cleanText($(element).text());

//     if (isUsableHeadline(text)) {
//       result = text;
//       return false;
//     }

//     return undefined;
//   });

//   return result;
// }

// function getElementHeadline($, $element) {
//   const ownText = cleanText($element.text());

//   const title = cleanText($element.attr("title"));

//   const ariaLabel = cleanText($element.attr("aria-label"));

//   const dataTitle = cleanText(
//     $element.attr("data-title") || $element.attr("data-headline"),
//   );

//   const imageAlt = cleanText($element.find("img[alt]").first().attr("alt"));

//   const directImageAlt = cleanText(
//     $element.is("img") ? $element.attr("alt") : "",
//   );

//   const $card = $element.closest(CARD_SELECTOR);

//   const cardHeadline = findFirstUsableText($, $card.find(HEADLINE_SELECTOR));

//   const parentHeadline = findFirstUsableText(
//     $,
//     $element.parent().find(HEADLINE_SELECTOR),
//   );

//   const siblingHeadline = findFirstUsableText(
//     $,
//     $element.siblings(HEADLINE_SELECTOR),
//   );

//   const candidates = [
//     cardHeadline,
//     parentHeadline,
//     siblingHeadline,
//     dataTitle,
//     title,
//     ariaLabel,
//     imageAlt,
//     directImageAlt,
//     ownText,
//   ];

//   return candidates.map(cleanText).find(isUsableHeadline) || "";
// }

// function getPublishedAtFromCard($, $element) {
//   const $card = $element.closest(CARD_SELECTOR);

//   const $time = $card.find("time").first();

//   const possibleValues = [
//     $time.attr("datetime"),
//     $time.attr("dateTime"),
//     $time.attr("content"),
//     $card.attr("data-published-at"),
//     $card.attr("data-published"),
//     $card.attr("data-timestamp"),
//     $card.attr("data-date"),
//     $card.find("[data-published-at]").first().attr("data-published-at"),
//     $card.find("[data-published]").first().attr("data-published"),
//     $card.find("[data-timestamp]").first().attr("data-timestamp"),
//   ];

//   for (const value of possibleValues) {
//     const normalizedDate = normalizePublishedAt(value);

//     if (normalizedDate) {
//       return normalizedDate;
//     }
//   }

//   return null;
// }

// function addCandidate(candidateMap, item, source = "unknown") {
//   const link = normalizeSKLink(item?.link || "");

//   const title = cleanText(item?.title || item?.headline || "");

//   if (!link) {
//     if (DEBUG) {
//       console.log(`[SK reject:${source}] Missing link`, item);
//     }

//     return;
//   }

//   if (!title) {
//     if (DEBUG) {
//       console.log(`[SK reject:${source}] Missing title`, link);
//     }

//     return;
//   }

//   if (!isUsableHeadline(title)) {
//     if (DEBUG) {
//       console.log(`[SK reject:${source}] Unusable title`, {
//         title,
//         link,
//       });
//     }

//     return;
//   }

//   if (!isSportskeedaCricketArticle(link)) {
//     if (DEBUG) {
//       console.log(`[SK reject:${source}] Invalid cricket article URL`, {
//         title,
//         link,
//       });
//     }

//     return;
//   }

//   if (isBlockedHeadline(title)) {
//     if (DEBUG) {
//       console.log(`[SK reject:${source}] Blocked headline`, {
//         title,
//         link,
//       });
//     }

//     return;
//   }

//   const candidate = {
//     title,
//     headline: title,
//     link,
//     publishedAt: normalizePublishedAt(item?.publishedAt),
//   };

//   const existingCandidate = candidateMap.get(link);

//   if (!existingCandidate) {
//     candidateMap.set(link, candidate);

//     if (DEBUG) {
//       console.log(`[SK accepted:${source}]`, candidate);
//     }

//     return;
//   }

//   candidateMap.set(link, {
//     ...existingCandidate,
//     title:
//       candidate.title.length > existingCandidate.title.length
//         ? candidate.title
//         : existingCandidate.title,
//     headline:
//       candidate.title.length > existingCandidate.headline.length
//         ? candidate.title
//         : existingCandidate.headline,
//     publishedAt: existingCandidate.publishedAt || candidate.publishedAt || null,
//   });
// }

// function findArticleUrlFromCard($, $element, baseUrl) {
//   const directUrl = getElementUrl($element, baseUrl);

//   if (directUrl) {
//     return directUrl;
//   }

//   let childUrl = null;

//   $element.find(URL_ELEMENT_SELECTOR).each((_, child) => {
//     if (childUrl) {
//       return false;
//     }

//     childUrl = getElementUrl($(child), baseUrl);

//     return childUrl ? false : undefined;
//   });

//   if (childUrl) {
//     return childUrl;
//   }

//   const $card = $element.closest(CARD_SELECTOR);

//   if (!$card.length) {
//     return null;
//   }

//   const cardUrl = getElementUrl($card, baseUrl);

//   if (cardUrl) {
//     return cardUrl;
//   }

//   let nestedCardUrl = null;

//   $card.find(URL_ELEMENT_SELECTOR).each((_, child) => {
//     if (nestedCardUrl) {
//       return false;
//     }

//     nestedCardUrl = getElementUrl($(child), baseUrl);

//     return nestedCardUrl ? false : undefined;
//   });

//   return nestedCardUrl;
// }

// function collectFromUrlElements($, baseUrl, candidateMap) {
//   $(URL_ELEMENT_SELECTOR).each((_, element) => {
//     const $element = $(element);

//     const link = getElementUrl($element, baseUrl);

//     if (!link) return;

//     const title = getElementHeadline($, $element);

//     if (!title) return;

//     addCandidate(
//       candidateMap,
//       {
//         link,
//         title,
//         publishedAt: getPublishedAtFromCard($, $element),
//       },
//       "url-element",
//     );
//   });
// }

// function collectFromHeadlineCards($, baseUrl, candidateMap) {
//   $(HEADLINE_SELECTOR).each((_, element) => {
//     const $headline = $(element);

//     const title = cleanText($headline.text());

//     if (!isUsableHeadline(title)) {
//       return;
//     }

//     const link = findArticleUrlFromCard($, $headline, baseUrl);

//     if (!link) {
//       if (DEBUG && title.length >= 30) {
//         console.log("[SK debug] Headline found but URL missing:", title);
//       }

//       return;
//     }

//     addCandidate(
//       candidateMap,
//       {
//         title,
//         link,
//         publishedAt: getPublishedAtFromCard($, $headline),
//       },
//       "headline-card",
//     );
//   });
// }

// function findDateInsideJson(value, depth = 0) {
//   if (!value || depth > 25) {
//     return null;
//   }

//   if (Array.isArray(value)) {
//     for (const entry of value) {
//       const result = findDateInsideJson(entry, depth + 1);

//       if (result) {
//         return result;
//       }
//     }

//     return null;
//   }

//   if (typeof value !== "object") {
//     return null;
//   }

//   const dateKeys = [
//     "datePublished",
//     "dateCreated",
//     "publishedAt",
//     "published_at",
//     "publishDate",
//     "publish_date",
//     "createdAt",
//     "created_at",
//     "dateModified",
//     "modifiedAt",
//     "modified_at",
//   ];

//   for (const key of dateKeys) {
//     const normalizedDate = normalizePublishedAt(value[key]);

//     if (normalizedDate) {
//       return normalizedDate;
//     }
//   }

//   for (const childValue of Object.values(value)) {
//     const result = findDateInsideJson(childValue, depth + 1);

//     if (result) {
//       return result;
//     }
//   }

//   return null;
// }

// function walkJson(value, candidateMap, depth = 0) {
//   if (!value || depth > 25) {
//     return;
//   }

//   if (Array.isArray(value)) {
//     value.forEach((entry) => {
//       walkJson(entry, candidateMap, depth + 1);
//     });

//     return;
//   }

//   if (typeof value !== "object") {
//     return;
//   }

//   const possibleLinks = [
//     value.url,
//     value.link,
//     value.href,
//     value.canonicalUrl,
//     value.canonical_url,
//     value.webUrl,
//     value.web_url,
//     value.articleUrl,
//     value.article_url,
//     value.slug,
//   ];

//   const possibleTitles = [
//     value.headline,
//     value.title,
//     value.name,
//     value.seoTitle,
//     value.seo_title,
//     value.articleTitle,
//     value.article_title,
//   ];

//   const link = possibleLinks
//     .map((entry) => {
//       if (typeof entry !== "string") {
//         return null;
//       }

//       return (
//         extractUrlFromText(entry, SPORTSKEEDA_BASE_URL) ||
//         normalizeSKLink(makeAbsoluteUrl(entry, SPORTSKEEDA_BASE_URL))
//       );
//     })
//     .find(Boolean);

//   const title = possibleTitles
//     .map((entry) => (typeof entry === "string" ? cleanText(entry) : ""))
//     .find(isUsableHeadline);

//   if (link && title) {
//     addCandidate(
//       candidateMap,
//       {
//         link,
//         title,
//         publishedAt:
//           value.datePublished ||
//           value.dateCreated ||
//           value.publishedAt ||
//           value.published_at ||
//           value.publishDate ||
//           value.publish_date ||
//           value.createdAt ||
//           value.created_at ||
//           null,
//       },
//       "json",
//     );
//   }

//   Object.values(value).forEach((entry) => {
//     walkJson(entry, candidateMap, depth + 1);
//   });
// }

// function collectFromJsonScripts($, candidateMap) {
//   const jsonScriptSelector = [
//     "script[type='application/ld+json']",
//     "script#__NEXT_DATA__",
//     "script[type='application/json']",
//   ].join(", ");

//   $(jsonScriptSelector).each((_, element) => {
//     const rawValue = $(element).html();

//     if (!rawValue) return;

//     try {
//       const parsedValue = JSON.parse(rawValue);

//       walkJson(parsedValue, candidateMap);
//     } catch (error) {
//       if (DEBUG) {
//         console.log(
//           "[SK debug] Invalid JSON script ignored:",
//           error instanceof Error ? error.message : String(error),
//         );
//       }
//     }
//   });
// }

// function collectFromRawHtml(html, candidateMap) {
//   const decodedHtml = decodeHtmlText(html);

//   const urlPattern =
//     /https?:\/\/(?:www\.)?sportskeeda\.com\/cricket\/[a-z0-9][^\s"'<>\\)\]}]*/gi;

//   const relativeUrlPattern = /\/cricket\/[a-z0-9][^\s"'<>\\)\]}]*/gi;

//   const matches = [
//     ...decodedHtml.matchAll(urlPattern),
//     ...decodedHtml.matchAll(relativeUrlPattern),
//   ];

//   matches.forEach((match) => {
//     const rawLink = match[0].replace(/[),.;]+$/, "");

//     const link = normalizeSKLink(
//       makeAbsoluteUrl(rawLink, SPORTSKEEDA_BASE_URL),
//     );

//     if (!link) return;

//     const matchIndex = match.index || 0;

//     const surroundingText = decodedHtml.slice(
//       Math.max(0, matchIndex - 1200),
//       matchIndex + 1500,
//     );

//     const titlePatterns = [
//       /"headline"\s*:\s*"([^"]{15,350})"/i,
//       /"title"\s*:\s*"([^"]{15,350})"/i,
//       /"name"\s*:\s*"([^"]{15,350})"/i,
//       /"seoTitle"\s*:\s*"([^"]{15,350})"/i,
//       /"seo_title"\s*:\s*"([^"]{15,350})"/i,
//       /"articleTitle"\s*:\s*"([^"]{15,350})"/i,
//       /"article_title"\s*:\s*"([^"]{15,350})"/i,
//     ];

//     const datePatterns = [
//       /"datePublished"\s*:\s*"([^"]+)"/i,
//       /"dateCreated"\s*:\s*"([^"]+)"/i,
//       /"publishedAt"\s*:\s*"([^"]+)"/i,
//       /"published_at"\s*:\s*"([^"]+)"/i,
//       /"publishDate"\s*:\s*"([^"]+)"/i,
//       /"publish_date"\s*:\s*"([^"]+)"/i,
//       /"createdAt"\s*:\s*"([^"]+)"/i,
//       /"created_at"\s*:\s*"([^"]+)"/i,
//     ];

//     let title = "";
//     let publishedAt = null;

//     for (const pattern of titlePatterns) {
//       const titleMatch = surroundingText.match(pattern);

//       const possibleTitle = cleanText(titleMatch?.[1]);

//       if (isUsableHeadline(possibleTitle)) {
//         title = possibleTitle;
//         break;
//       }
//     }

//     for (const pattern of datePatterns) {
//       const dateMatch = surroundingText.match(pattern);

//       const possibleDate = normalizePublishedAt(dateMatch?.[1]);

//       if (possibleDate) {
//         publishedAt = possibleDate;
//         break;
//       }
//     }

//     if (!title) return;

//     addCandidate(
//       candidateMap,
//       {
//         link,
//         title,
//         publishedAt,
//       },
//       "raw-html",
//     );
//   });
// }

// function extractPublishedAtFromDocument($, html = "") {
//   const metaSelectors = [
//     'meta[property="article:published_time"]',
//     'meta[name="article:published_time"]',
//     'meta[property="og:published_time"]',
//     'meta[name="publish-date"]',
//     'meta[name="publish_date"]',
//     'meta[name="date"]',
//     'meta[name="parsely-pub-date"]',
//     'meta[itemprop="datePublished"]',
//   ];

//   for (const selector of metaSelectors) {
//     const value = $(selector).first().attr("content");

//     const normalizedDate = normalizePublishedAt(value);

//     if (normalizedDate) {
//       return normalizedDate;
//     }
//   }

//   const timeSelectors = [
//     "time[datetime]",
//     "[itemprop='datePublished'][datetime]",
//     "[itemprop='datePublished'][content]",
//     "[data-published-at]",
//     "[data-published]",
//     "[data-timestamp]",
//   ];

//   for (const selector of timeSelectors) {
//     const $element = $(selector).first();

//     if (!$element.length) {
//       continue;
//     }

//     const value =
//       $element.attr("datetime") ||
//       $element.attr("content") ||
//       $element.attr("data-published-at") ||
//       $element.attr("data-published") ||
//       $element.attr("data-timestamp") ||
//       $element.text();

//     const normalizedDate = normalizePublishedAt(value);

//     if (normalizedDate) {
//       return normalizedDate;
//     }
//   }

//   const jsonSelectors = [
//     "script[type='application/ld+json']",
//     "script#__NEXT_DATA__",
//     "script[type='application/json']",
//   ];

//   for (const element of $(jsonSelectors.join(", ")).toArray()) {
//     const rawJson = $(element).html();

//     if (!rawJson) continue;

//     try {
//       const parsedJson = JSON.parse(rawJson);

//       const publishedAt = findDateInsideJson(parsedJson);

//       if (publishedAt) {
//         return publishedAt;
//       }
//     } catch {
//       // Ignore invalid JSON.
//     }
//   }

//   const decodedHtml = decodeHtmlText(html);

//   const rawDatePatterns = [
//     /"datePublished"\s*:\s*"([^"]+)"/i,
//     /"dateCreated"\s*:\s*"([^"]+)"/i,
//     /"publishedAt"\s*:\s*"([^"]+)"/i,
//     /"published_at"\s*:\s*"([^"]+)"/i,
//     /"publishDate"\s*:\s*"([^"]+)"/i,
//     /"publish_date"\s*:\s*"([^"]+)"/i,
//     /"createdAt"\s*:\s*"([^"]+)"/i,
//     /"created_at"\s*:\s*"([^"]+)"/i,
//   ];

//   for (const pattern of rawDatePatterns) {
//     const match = decodedHtml.match(pattern);

//     const normalizedDate = normalizePublishedAt(match?.[1]);

//     if (normalizedDate) {
//       return normalizedDate;
//     }
//   }

//   return null;
// }

// // async function fetchPage(url) {
// //   const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// //   // Small random delay before each request -- cheap to add, doesn't hurt,
// //   // and helps if there's also a behavioral/rate-limiting layer stacked on
// //   // top of the fingerprint check below. Not expected to be the primary fix
// //   // for a 405 specifically (that's more commonly a header/fingerprint
// //   // check than a timing one), but costs nothing to include.
// //   const jitterMs = 500 + Math.random() * 2000;
// //   await new Promise((resolve) => setTimeout(resolve, jitterMs));

// //   const response = await axios.get(url, {
// //     timeout: REQUEST_TIMEOUT_MS,
// //     maxRedirects: 5,
// //     responseType: "text",
// //     decompress: true,

// //     // res = await fetch(CA_RSS, {
// //     //     signal: controller.signal,
// //     //     headers: {
// //     //       "User-Agent": pickUA(),
// //     //       Accept:
// //     //         "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
// //     //       "Accept-Language": "en-US,en;q=0.9",
// //     //       "Accept-Encoding": "gzip, deflate, br",
// //     //       Referer: "https://www.google.com/search?q=cricket+news",
// //     //       Connection: "keep-alive",
// //     //       "Cache-Control": "no-cache",
// //     //       "Sec-Fetch-Dest": "document",
// //     //       "Sec-Fetch-Mode": "navigate",
// //     //       "Sec-Fetch-Site": "cross-site",
// //     //       "Upgrade-Insecure-Requests": "1",
// //     //     },
// //     //   });

// //     headers: {
// //       "User-Agent": pickUA(),
// //       Accept:
// //         "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
// //       "Accept-Language": "en-US,en;q=0.9",
// //       "Accept-Encoding": "gzip, deflate, br",
// //       Referer: "https://www.google.com/search?q=cricket+news",
// //       Connection: "keep-alive",
// //       "Cache-Control": "no-cache",
// //       "Sec-Fetch-Dest": "document",
// //       "Sec-Fetch-Mode": "navigate",
// //       "Sec-Fetch-Site": "cross-site",
// //       "Upgrade-Insecure-Requests": "1",
// //     },

// //     // headers: {
// //     //   "User-Agent": userAgent,
// //     //   Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
// //     //   "Accept-Language": "en-US,en;q=0.9",
// //     //   "Accept-Encoding": "gzip, deflate, br",
// //     //   Referer: "https://www.google.com/",
// //     //   "Cache-Control": "no-cache",
// //     //   Pragma: "no-cache",
// //     //   "Sec-Ch-Ua":
// //     //     '"Not_A Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
// //     //   "Sec-Ch-Ua-Mobile": "?0",
// //     //   "Sec-Ch-Ua-Platform": '"macOS"',
// //     //   "Sec-Fetch-Dest": "document",
// //     //   "Sec-Fetch-Mode": "navigate",
// //     //   "Sec-Fetch-Site": "none",
// //     //   "Sec-Fetch-User": "?1",
// //     //   "Upgrade-Insecure-Requests": "1",
// //     // },

// //     validateStatus: (status) => status >= 200 && status < 400,
// //   });

// //   const html =
// //     typeof response.data === "string"
// //       ? response.data
// //       : String(response.data || "");

// //   const finalUrl = response.request?.res?.responseUrl || url;

// //   return {
// //     html,
// //     finalUrl,
// //     status: response.status,
// //   };
// // }

// async function fetchPage(url) {
//   if (!SCRAPERAPI_KEY) {
//     throw new Error(
//       "SCRAPERAPI_KEY is not set -- SK requests must be routed through ScraperAPI since Railway's IP range is blocked directly by SportsKeeda's WAF. Set the SCRAPERAPI_KEY env var.",
//     );
//   }

//   const response = await axios.get(SCRAPERAPI_ENDPOINT, {
//     timeout: REQUEST_TIMEOUT_MS,
//     responseType: "text",
//     decompress: true,

//     params: {
//       api_key: SCRAPERAPI_KEY,
//       url,
//     },

//     validateStatus: (status) => status >= 200 && status < 400,
//   });

//   const html =
//     typeof response.data === "string"
//       ? response.data
//       : String(response.data || "");

//   // ScraperAPI proxies the fetch server-side -- it doesn't expose SK's own
//   // redirect chain the way a direct request would, so there's no reliable
//   // "final URL after redirects" to read here. Falling back to the
//   // originally requested URL; this only affects the DEBUG-only finalUrl
//   // logging below, not the actual scraped content.
//   const finalUrl = url;

//   return {
//     html,
//     finalUrl,
//     status: response.status,
//   };
// }

// // async function fetchPage(url) {
// //   const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

// //   // Small random delay before each request -- cheap to add, doesn't hurt,
// //   // and helps if there's also a behavioral/rate-limiting layer stacked on
// //   // top of the fingerprint check below. Not expected to be the primary fix
// //   // for a 405 specifically (that's more commonly a header/fingerprint
// //   // check than a timing one), but costs nothing to include.
// //   const jitterMs = 500 + Math.random() * 2000;
// //   await new Promise((resolve) => setTimeout(resolve, jitterMs));

// //   const response = await axios.get(url, {
// //     timeout: REQUEST_TIMEOUT_MS,
// //     maxRedirects: 5,
// //     responseType: "text",
// //     decompress: true,

// //     // res = await fetch(CA_RSS, {
// //     //     signal: controller.signal,
// //     //     headers: {
// //     //       "User-Agent": pickUA(),
// //     //       Accept:
// //     //         "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
// //     //       "Accept-Language": "en-US,en;q=0.9",
// //     //       "Accept-Encoding": "gzip, deflate, br",
// //     //       Referer: "https://www.google.com/search?q=cricket+news",
// //     //       Connection: "keep-alive",
// //     //       "Cache-Control": "no-cache",
// //     //       "Sec-Fetch-Dest": "document",
// //     //       "Sec-Fetch-Mode": "navigate",
// //     //       "Sec-Fetch-Site": "cross-site",
// //     //       "Upgrade-Insecure-Requests": "1",
// //     //     },
// //     //   });

// //     headers: {
// //       "User-Agent": pickUA(),
// //       Accept:
// //         "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
// //       "Accept-Language": "en-US,en;q=0.9",
// //       "Accept-Encoding": "gzip, deflate, br",
// //       Referer: "https://www.google.com/search?q=cricket+news",
// //       Connection: "keep-alive",
// //       "Cache-Control": "no-cache",
// //       "Sec-Fetch-Dest": "document",
// //       "Sec-Fetch-Mode": "navigate",
// //       "Sec-Fetch-Site": "cross-site",
// //       "Upgrade-Insecure-Requests": "1",
// //     },

// //     // headers: {
// //     //   "User-Agent": userAgent,
// //     //   Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
// //     //   "Accept-Language": "en-US,en;q=0.9",
// //     //   "Accept-Encoding": "gzip, deflate, br",
// //     //   Referer: "https://www.google.com/",
// //     //   "Cache-Control": "no-cache",
// //     //   Pragma: "no-cache",
// //     //   "Sec-Ch-Ua":
// //     //     '"Not_A Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
// //     //   "Sec-Ch-Ua-Mobile": "?0",
// //     //   "Sec-Ch-Ua-Platform": '"macOS"',
// //     //   "Sec-Fetch-Dest": "document",
// //     //   "Sec-Fetch-Mode": "navigate",
// //     //   "Sec-Fetch-Site": "none",
// //     //   "Sec-Fetch-User": "?1",
// //     //   "Upgrade-Insecure-Requests": "1",
// //     // },

// //     validateStatus: (status) => status >= 200 && status < 400,
// //   });

// //   const html =
// //     typeof response.data === "string"
// //       ? response.data
// //       : String(response.data || "");

// //   const finalUrl = response.request?.res?.responseUrl || url;

// //   return {
// //     html,
// //     finalUrl,
// //     status: response.status,
// //   };
// // }

// async function fetchArticlePublishedAt(articleUrl) {
//   try {
//     const { html, finalUrl } = await fetchPage(articleUrl);

//     const $ = cheerio.load(html);

//     const publishedAt = extractPublishedAtFromDocument($, html);

//     if (DEBUG) {
//       console.log("[SK date]", {
//         articleUrl,
//         finalUrl,
//         publishedAt,
//       });
//     }

//     return publishedAt;
//   } catch (error) {
//     if (DEBUG) {
//       console.log("[SK date] Failed:", {
//         articleUrl,
//         error: error instanceof Error ? error.message : String(error),
//       });
//     }

//     return null;
//   }
// }

// async function enrichMissingPublishedDates(
//   items,
//   concurrency = DATE_CONCURRENCY,
// ) {
//   const enrichedItems = [...items];

//   for (let index = 0; index < enrichedItems.length; index += concurrency) {
//     const batch = enrichedItems.slice(index, index + concurrency);

//     const results = await Promise.allSettled(
//       batch.map(async (item) => {
//         const existingDate = normalizePublishedAt(item.publishedAt);

//         if (existingDate) {
//           return {
//             ...item,
//             publishedAt: existingDate,
//           };
//         }

//         const publishedAt = await fetchArticlePublishedAt(item.link);

//         return {
//           ...item,
//           publishedAt,
//         };
//       }),
//     );

//     results.forEach((result, batchIndex) => {
//       if (result.status === "fulfilled") {
//         enrichedItems[index + batchIndex] = result.value;
//       }
//     });
//   }

//   return enrichedItems;
// }

// function sortByPublishedAt(items) {
//   return [...items].sort((a, b) => {
//     const aTimestamp = a.publishedAt ? Date.parse(a.publishedAt) : 0;

//     const bTimestamp = b.publishedAt ? Date.parse(b.publishedAt) : 0;

//     return bTimestamp - aTimestamp;
//   });
// }

// /**
//  * Fetches Sportskeeda cricket articles.
//  *
//  * Returns:
//  * [
//  *   {
//  *     title,
//  *     headline,
//  *     link,
//  *     publishedAt
//  *   }
//  * ]
//  */
// export async function fetchSKCricketHtml({ limit = 50 } = {}) {
//   const candidateMap = new Map();
//   const requestErrors = [];

//   for (const requestedUrl of SK_CRICKET_URLS) {
//     try {
//       const { html, finalUrl, status } = await fetchPage(requestedUrl);

//       const $ = cheerio.load(html);

//       if (DEBUG) {
//         console.log("[SK debug] Page fetched:", {
//           requestedUrl,
//           finalUrl,
//           status,
//           htmlLength: html.length,
//           pageTitle: cleanText($("title").text()),
//           totalAnchors: $("a[href]").length,
//           cricketAnchors: $("a[href*='/cricket/']").length,
//           jsonScripts: $(
//             "script[type='application/ld+json'], script#__NEXT_DATA__, script[type='application/json']",
//           ).length,
//         });
//       }

//       collectFromUrlElements($, finalUrl, candidateMap);

//       collectFromHeadlineCards($, finalUrl, candidateMap);

//       collectFromJsonScripts($, candidateMap);

//       collectFromRawHtml(html, candidateMap);

//       if (DEBUG) {
//         console.log(
//           `[SK debug] Candidate count after ${requestedUrl}:`,
//           candidateMap.size,
//         );
//       }

//       if (candidateMap.size >= limit) {
//         break;
//       }
//     } catch (error) {
//       const message = error instanceof Error ? error.message : String(error);

//       requestErrors.push({
//         url: requestedUrl,
//         message,
//       });

//       console.error("[Sportskeeda] Failed to fetch page:", {
//         url: requestedUrl,
//         message,
//       });
//     }
//   }

//   const discoveredItems = [...candidateMap.values()].slice(0, limit);

//   if (DEBUG) {
//     console.log(
//       "[SK debug] Discovered items before date enrichment:",
//       discoveredItems.length,
//     );
//   }

//   const itemsWithDates = await enrichMissingPublishedDates(
//     discoveredItems,
//     DATE_CONCURRENCY,
//   );

//   const items = sortByPublishedAt(itemsWithDates).slice(0, limit);

//   if (DEBUG) {
//     console.log(`[SK debug] Final items: ${items.length}`);

//     console.log("[SK debug] Sample items:", items.slice(0, 10));
//   }

//   if (items.length === 0 && requestErrors.length === SK_CRICKET_URLS.length) {
//     throw new Error(
//       `All Sportskeeda requests failed: ${requestErrors
//         .map(({ url, message }) => `${url}: ${message}`)
//         .join(" | ")}`,
//     );
//   }

//   return items;
// }

// export default fetchSKCricketHtml;
