# Sportskeeda Cricket source

This folder mirrors the existing `cricket-addictor` pipeline but discovers articles from the Sportskeeda cricket landing page instead of the mixed Sportskeeda RSS feed.

## Expected parent-project structure

```text
project-root/
├── ai/
├── canvas/
├── indian-express/
├── twitter/
├── utils/
└── sportskeeda-cricket/
```

## Files

- `fetchSKCricketHtml.js` — collects cricket-only article URLs using Axios + Cheerio.
- `parseSKArticle.js` — extracts headline, body, image, date and author.
- `skFilters.js` — validates and normalizes Sportskeeda cricket URLs.
- `skHeadlineFilter.js` — blocks predictions, fantasy, live-score and schedule content.
- `skNewsPollingLoop.js` — complete generation, duplicate-check, card, queue and state flow.
- `testSKScraper.js` — tests listing discovery and article parsing without AI.
- `testSKTweet.js` — generates a console-only tweet using GPT, Gemini or Claude.

## Dependencies

The parent project must already include:

```bash
npm install axios cheerio dotenv
```

The OCR files retain the same dependencies used by the Cricket Addictor folder.

## Test scraper

```bash
node sportskeeda-cricket/testSKScraper.js 15
```

## Test a tweet

```bash
node sportskeeda-cricket/testSKTweet.js "SPORTSKEEDA_CRICKET_ARTICLE_URL" claude
node sportskeeda-cricket/testSKTweet.js "SPORTSKEEDA_CRICKET_ARTICLE_URL" gpt
node sportskeeda-cricket/testSKTweet.js "SPORTSKEEDA_CRICKET_ARTICLE_URL" gemini
```

By default, prompt/model files are loaded from `../ai`. Override temporarily with:

```bash
AI_DIR=../another-ai-folder node sportskeeda-cricket/testSKTweet.js "ARTICLE_URL" claude
```

## Polling integration

Import and call:

```js
import { skNewsPollingLoop } from "./sportskeeda-cricket/skNewsPollingLoop.js";

await skNewsPollingLoop();
```

Optional environment variables:

```env
SK_FETCH_LIMIT=50
SK_MAX_AGE_MIN=180
SK_REQUEST_TIMEOUT_MS=15000
```

## Source signature / quiet-hours integration

The polling loop uses source code `SK` and calls the existing `isCricketAddictorBlocked("SK")` helper because that helper already exists in the supplied project. Rename that helper to a generic source-blocking function later if desired. Ensure `applySourceSignature()` and the queue configuration recognize `SK`.

## Notes

Sportskeeda does not expose a useful public cricket-only RSS feed here. The general feed is mixed, so this implementation discovers links from `https://www.sportskeeda.com/cricket` and then parses each selected article page.
