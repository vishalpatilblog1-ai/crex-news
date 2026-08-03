// cricket-addictor/caNewsPollingLoop.js

import {
  generateGPTTweet,
  generateGPTTweetWithType,
} from "../ai/generate-gpt-tweet.js";
import {
  classifyArticle,
  generateClaudeTweet,
  generateClaudeTweetWithType,
  SIGNIFICANCE_EXEMPT_TYPES,
} from "../ai/generateClaudeTweet.js";
import { generateCardImage } from "../canvas/imageRenderer.js";
import { judgeNewsContext } from "../indian-express/ai/judgeNewsContext.js";
import {
  applySourceSignature,
  enqueueTweet,
  isCricketAddictorBlocked,
} from "../twitter/tweetQueue.js";
import { CREX_BASE_IMAGE_TEMPLATE } from "../utils/config.js";
import { saveState } from "../utils/stateStoreCloud.js";

import { isCAArticle, normalizeCALink } from "./caFilters.js";
import { isBlockedCAHeadline } from "./caHeadlineFilter.js";
import { fetchCARSS } from "./fetchCARss.js";
import { isRiskyTwitterImage } from "./ocr/detectTwitterReference.js";
import { downloadImageToTemp } from "./ocr/downloadImageToTemp.js";
import { parseCAArticleRss } from "./parseCAArticleRss.js";

const MAX_AGE_MIN = 60;
const CONSOLE_ONLY = process.env.CONSOLE_ONLY === "true";
const RETENTION_MS = 6 * 60 * 60 * 1000; // dailyContext / usedImages
const SEEN_RETENTION_MS = 24 * 60 * 60 * 1000; // ca.seen — kept longer so a same-day pubDate bump on an already-tweeted article can't slip past dedup

export async function caNewsPollingLoop() {
  if (!global.STATE) return false;

  if (isCricketAddictorBlocked("CA")) {
    console.log("🚫 CA polling paused (11:30 PM – 6:00 AM window)");
    return false;
  }

  const STATE = global.STATE;

  STATE.ca ??= {};
  STATE.ca.seen ??= {};
  STATE.dailyContext ??= { contexts: [] };
  STATE.usedImages ??= {};

  // ── Prune state ───────────────────────────────────────────────────────────
  let stateDirty = false;
  stateDirty ||= pruneSeen(STATE, SEEN_RETENTION_MS);
  stateDirty ||= pruneDailyContext(STATE, RETENTION_MS);
  stateDirty ||= pruneUsedImages(STATE, RETENTION_MS);

  if (stateDirty) await saveState(STATE, "prune cleanup");

  // ── Fetch RSS ─────────────────────────────────────────────────────────────
  let items;
  try {
    items = await fetchCARSS();
  } catch (err) {
    console.warn("❌ CA RSS fetch failed:", err?.message || err);
    throw err;
  }

  if (!Array.isArray(items) || items.length === 0) return false;

  const sorted = [...items]
    .filter(isCAArticle)
    .sort((a, b) => getPubDate(b) - getPubDate(a));

  let selected = null;

  for (const item of sorted) {
    const pubMs = getPubDate(item);

    if (pubMs) {
      const ageMin = (Date.now() - pubMs) / 60000;
      if (ageMin > MAX_AGE_MIN) continue;
    }

    const cleanLink = normalizeCALink(item.link);
    if (!cleanLink) continue;

    if (STATE.ca.seen[cleanLink]) continue;

    if (isBlockedCAHeadline(item.title)) {
      STATE.ca.seen[cleanLink] = Date.now();
      continue;
    }

    selected = item;
    break;
  }

  if (!selected) return false;

  const cleanLink = normalizeCALink(selected.link);
  const pubMs = getPubDate(selected);

  try {
    const parsed = parseCAArticleRss(selected);

    if (!parsed?.headline || !parsed?.body || parsed.body.length < 80) {
      STATE.ca.seen[cleanLink] = Date.now();
      await saveState(STATE, "invalid article structure");
      return false;
    }

    const fullText = `${parsed.headline}\n${parsed.body}`;

    // const fullText = `तो मेरे नाम से एक खबर चल रही है जो चेन्नई सुपर किंग्स और दिल्ली कैपिटल्स के बीच ट्रेड की बात कही जा रही है। राहुल चहर एंड उस तरफ से होंगे आशुतोष शर्मा। इस खबर की कंफर्मेशन मैंने कहीं पर नहीं की है। आई हैवंट कंफर्म्ड इट। ये जो पूरा का पूरा ट्रेड है, द ट्रेड टॉक्स बिटवीन दिल्ली कैपिटल्स एंड सीएसके बिटवीन आशुतोष शर्मा एंड राहुल चहर। बीच-बीच में थोड़ी सी अंग्रेजी इसलिए आएगी क्योंकि मुझे बहुत सारे मैसेज तमिलनाडु से आए हैं, चेन्नई से आए हैं और बहुत सारे लोग वहां पर भी कंटेंट कंज्यूम कर रहे हैं। सो बहुत हल्की सी अंग्रेजी जो मेन पॉइंट्स होंगे वो सिर्फ बताए जाएंगे। ओनली वन रिक्वेस्ट मैं इस पूरे के पूरे वीडियो में आपको हार्दिक पांड्या को लेकर के लेटेस्ट क्या है बताऊंगा। तीन फ्रेंचाइजीज जो अभी भी इस रेस में पूरी तरीके से बनी हुई है। मेनी पीपल आर डिनाइंग दैट नाउ इट्स ओनली अबाउट चेन्नई सुपर किंग्स। नो इट्स नॉट सिर्फ यह चेन्नई सुपर किंग्स को लेकर के नहीं है। मैं फिर से कह देता हूं। केकेआर इज वेरी मच इन। दिल्ली कैपिटल्स इज़ वेरी मच इन। आप आगे पीछे कह सकते हैं कुछ टीमों को। देयर आर सर्टेन टीम्स जो थोड़ा आगे है एंड देन देयर आर सर्टेन टीम्स जो थोड़ा सा पीछे हैं। बट यू कैन नॉट रूल आउट। ये बात यू नो क्लियर कट है। एटलीस्ट जहां तक मेरे सोर्सेस मुझे कंफर्म करते हैं। नाउ मैं आपको हार्दिक पांड्या की स्थिति बताऊंगा। तीनों टीमों के बारे में बताऊंगा। यह जो खबर मेरे नाम से चल रही है, इसके बारे में हम बात करेंगे। यह फिटनेस कैंप जो मैंने खबर ब्रेक करी थी, उसके बारे में भी बात करूंगा। बिकॉज़ मैंने एक प्लेयर से पूछा जो ऑलमोस्ट चार से पांच फिटनेस कैंप कर चुका है। एंड व्हाट ही हैज़ टोल्ड मी अराउंड दिस फिटनेस कैंप। यू नो ही हैज़ अटेंडेड मल्टीपल कैंप्स। आई हैड अ चैट विथ हिम। और उसने मुझे एग्जैक्टली क्या कुछ बताया इस चीज के बारे में वो मैं आपके सामने रखूंगा। एंड देन यू नो हम इस इसके पूरे कंक्लूसिव पार्ट पर भी जाएंगे। बट माय ओनली रिक्वेस्ट प्लीज लाइक, शेयर, सब्सक्राइब एंड हिट दैट नोटिफिकेशन बेल। डू मेक श्योर कि आप कमेंट करें। यू कमेंट एंड टेल योर रिएक्शन। और उसके लिए सबसे बढ़िया यह होगा कि आप पूरा वीडियो देखें। वॉच द फुल वीडियो एंड देन रिएक्ट। डोंट जंप द गन। दैट्स माय ओनली रिक्वेस्ट। अब शुरुआत से शुरू करते हैं। और उससे पहले बस एक और रिक्वेस्ट है मेरी आप लोगों से। दिस इज माय tlegram चैनल। लिंक इसका आपको कमेंट बॉक्स में मिल जाएगा, डिस्क्रिप्शन में भी मिल जाएगा। यहां पर खबरें अब सबसे पहले आया करेंगी। Telegram चैनल पर। Instagram पर सबसे पहले रील आया करेगी। थोड़ा सा फॉर्मेट बदल रहे हैं। Twitter पे ठीक है खबर डाल देंगे। बट सबसे पहले न्यूज़ जहां जिन दो जगहों पर ब्रेक होगी वो Telegram चैनल है और वो Instagram है। यहां पर पर साइमलटेनियसली न्यूज़ आएगी और उसके बाद हम Twitter पर जाएंगे एंड देन YouTube लॉन्ग फॉर्म हम करेंगे ही उसकी डिटेल्स में जाने के लिए। सो अगर आपने यहां पर फॉलो नहीं किया है, यहां पर नहीं जुड़े हो, तो डू मेक श्योर यू जॉइ द Telegram चैनल बिकॉज़ एवरी ब्रेकिंग न्यूज़ विल कम फर्स्ट देयर। और इसके साथ-साथ आपको Instagram यू विल गेट इट इन द Instagram रील्स आल्सो। सो Instagram रील एंड Telegram विल बी द प्रायोरिटी देन एक्स हैंडल एंड लेटर फॉर द लॉन्ग फॉर्म कंटेंट इट वुड बी इट विल बी YouTube। सो एक-एक कर कर अगर मैं आऊं सबसे पहले तो पहली चीज जो मैंने राहुल चहर और आशुतोष शर्मा के बारे में बोली। मैंने क्या कहा? मैंने ये कहा कि मुझे मेरे एक मित्र ने ये बताया है कि आप पता कीजिए कि इस तरह की एक चर्चा चल निकली है। और इस तरह की चर्चा चल निकली है तो मैं उसे पता करूंगा। मैंने पता किया मैंने दो-दो बार फोन पे बात कर ली। मैंने पिछले 48 आवर्स इन लास्ट 48 आवर्स आई हैव टू कॉल्स अराउंड दिस ये वाला जो ट्रेड है। नाउ द फर्स्ट थिंग जो सबसे पहली चीज है मुझे ये कहा गया कि इसकी पॉसिबिलिटी है किस एंड से कहा गया आई डोंट आई आई डोंट वांट टू गेट इंटू द डिटेल्स दैट व्हिच फ्रेंचाइजी इज सेइंग यस और व्हिच फ्रेंचाइजी इज़ इवन नोटिंग फॉर यस। कौन सी फ्रेंचाइजी ये कह रही है कि हां यार हम थोड़े बहुत इंटरेस्टेड भी हैं या कौन सी फ्रेंचाइजी इसको लेकर के बात कर रही है? मैं बहुत डिटेल्स में नहीं जाऊंगा इसकी बिकॉज़ ये अभी भी बहुत अदपका सा है। इस पर कोई सब्सटैंशियल डेवलपमेंट नहीं है। इसीलिए मैं इसे किसी भी तरीके से कंफर्मेशन की तरफ नहीं ले जाऊंगा। सो जिन्होंने भी मेरे नाम से ये खबर जोड़ी मैं अगेन उनको ये कहना चाहता हूं आप चाहे 48 आवर्स पुराना वो वीडियो देख लीजिए। हमने कहीं कंफर्म नहीं किया है दैट द डील इज डन। डील डन होना और बातचीत होने में बहुत बड़ा अंतर है। जमीन आसमान का अंतर है। इट्स चॉकन चीज। लास्ट टाइम अराउंड वाशिंगटन सुंदर मल्टीपल कन्वर्सेशंस चेन्नई सुपर किंग्स जीटी कपल ऑफ कॉन्वर्सेशंस वि डिफरेंट काइंड ऑफ परमिटेशंस एंड कॉम्बिनेशंस हुआ नहीं लेकिन क्या बातचीत नहीं हुई ये कहना गलत होगा लेकिन क्या डील डन हो गई थी ये कहना गलत होगा बातचीत हुई थी डील नहीं हुई लाइक संजू सैमसन एंड दिल्ली कैपिटल्स बातचीत हुई थी डील नहीं हुई चेन्नई सुपर किंग्स के साथ बातचीत भी हुई और डील हो गई यहां पर अभी एक टीम की तरफ से इस बारे में सोचा जा रहा है दूसरी टीम को हो हो सकता है पता भी ना हो इस चीज के बारे में। बट ये चीज़ मैं आपको कह सकता हूं कि दिल्ली कैपिटल्स इज़ श्योरली लुकिंग फॉर समवन हु इज यू नो हु कैन हेल्प देम एस फार एस ये जो रिस्क स्पिन कंसर्न करता है एंड देन कैप प्लेयर हो तो क्या ही कहना। लेकिन यस दे विल बी लुकिंग फॉरवर्ड टू समवन जो इस तरीके से उनको हेल्प कर सके। वजह कुलदीप यादव चले गए हैं। एंड वी ऑल नो चेन्नई सुपर किंग्स इज़ डेफिनेटली लुकिंग फॉर अ फिनिशर जो जिस जिसके पास वो पेडिग्री हो व्हिच आशुतोष शर्मा होल्ड्स एट दिस पॉइंट ऑफ़ टाइम। आशुतोष शर्मा के पास वो सब कुछ है जो इस समय पर चेन्नई सुपर किंग्स को चाहिए। जहां तक बात फिनिशिंग को लेकर के आती है। द बिगेस्ट थिंग इज़ आशुतोष को लेकर के कि पंजाब के बाद से ना दो साल हो गए उसका करियर कहीं ऊपर नहीं जा रहा है। वो प्रोफाइल रुक गई है उसकी। वहीं शशांक का इस बार अच्छा नहीं गया। शशांक को क्यों लेकर आ रहा हूं? क्योंकि ये दोनों एक साथ उठे थे और शशांक थोड़ा आगे निकला 2025l में जहां पर पंजाब ने फाइनल खेला। बट शशांक का येl बहुत ही खराब चला गया है। आशुतोष पिछले दो सालों से इस सीजन उसको बहुत ज्यादा चांसेस ही नहीं मिले। इस सीजन क्या अगर आप दिल्ली कैपिटल्स में उसकी जर्नी देखते हो उसने सिंगल हैंडेडली मैच जिताया। मैं ये नहीं कह रहा आशुतोष कहीं पर भी जिम्मेदार नहीं है। बट टीम उसको वो मौका नहीं दे रही है। उसको वो मौका नहीं मिल पा रहा है। परम्यूटेशंस एंड कॉम्बिनेशंस की वजह से शुरुआत में रिवी ने अच्छा कर दिया तो उसे मौका नहीं मिला। बाद में लेटर हाफ में आपने उसको मौका दिया। सो उसको मौका नहीं मिल रहा और उसकी प्रोफाइल ठहर गई है। वो 17 साल का नहीं है कि अगले पांच छ साल उसके पास हो और वो यू नो काम कर सके अपनी चीजों पर और वो इंतजार कर सके। नहीं ही कैन नॉट वेट। आप देखो वो इंग्लैंड में खेल रहा है इस समय पर वहां परफॉर्म कर रहा है। उसने पंजाब के लिए परफॉर्म किया है। उसने दिल्ली के लिए भी जबजब मौके आपने दिए हैं परफॉर्म किया है और वो आगे भी परफॉर्म करेगा बिकॉज़ ही हैस दैट इन हिम। नाउ द थिंग इज कि क्या ये होगा? जिस दिन ये होगा मैं आपको बता दूंगा। बट अभी इट्स जस्ट वन साइडेड कॉन्वर्सेशन। कौन सी साइड बात कर रही है इसकी डिटेल्स में नहीं जाते हैं। और जैसा मैंने कहा अपनी-अपनी तलाश दोनों टीमों को है। अपने-अपने तरह के खिलाड़ियों की तलाश दोनों टीमों को है। लेकिन अभी इट्स इट्स वेरी प्रीमेच्योर कि हम यह कहें कि डील डन हो चुकी है। सो मैं ये क्लेरिटी दे चुका हूं। आई होप कि जिन भी लोगों ने मुझे लेकर वो खबर चलाई थी, यह वीडियो आप लोग उन तक पहुंचाओगे। दैट्स व्हाई आई एम सेइंग कि बी वेरी मच अटेंटिव ऑन व्हाट एकजेक्टली यू आर लिसनिंग और उसके पूरे पार्ट को देखोगे देन यू विल गेट दी एग्जैक्ट डिटेल्स। अब देखो इसमें कुछ हद तक जो चीजें हैं वो जुड़ी है इस कॉन्वर्सेशन में बिटवीन समथिंग फ्रॉम दिल्ली एंड फ्रॉम सीएसके वरना मैं यू नो अलग-अलग नाम ले सकता था। मैं चाहता तो रवि बिश्नोई का नाम ले लेता। मैं कहता कि रवि बिश्नोई को मौका नहीं मिला। यशराज पुजा आ गए हैं। यशराज पुजा के बाद रवि बिश्नोई एक कैप प्लेयर है। इधर आ सकता है। नहीं मैंने नाम नहीं लिया। शिवा कुमार, जीशान अंसारी, हर्ष दुबे, सनराइज़र्स हैदराबाद के पास मल्टीपल बॉलर्स हैं। मैंने किसी का भी नाम नहीं लिया। इसके अलावा और भी बहुत सारी टीमें हैं जहां पर अलग-अलग ऑप्शंस आपको देखने को मिल जाएंगे। बट हम किसी और का नाम नहीं ले रहे हैं। इसीलिए नहीं ले रहे हैं किसी और का नाम बिकॉज़ देयर आर सर्टेन हिंट्स। लेकिन अभी वो जैसा मैंने कहा बहुत कमजोर है इसको एक ट्रेड डील के रूप में आपके सामने रखने को लेकर के बट जो है वो आपको बता दिया। नाउ द सेकंड थिंग इज एंड द मोस्टेंट थिंग इज हार्दिक पांड्या जैसा मैंने कहा एग्जैक्टली हार्दिक पांड्या चेन्नई सुपर किंग्स और हार्दिक पांड्या डिपेंड्स कि आप मुंबई इंडियंस को क्या दे रहे हो और उससे भी ज्यादाेंट मुंबई इंडियंस क्या उसको एक्सेप्ट कर रहा है या नहीं। मुंबई इंडियंस हमेशा से फास्ट बॉलर्स की तलाश में है। इस पूरे के पूरे सीजन उनको ये इंतजार रहेगा कि उनके पास फास्ट बॉलर्स आए। वो फास्ट बॉलर्स कौन से हो सकते हैं? आप उन्हें क्या खलील अहमद दोगे? क्या वो खलील अहमद को एक्सेप्ट करेंगे? आई थिंक एट दिस पॉइंट ऑफ़ टाइम द जो बॉलर वो एक्सेप्ट करेंगे। दैट्स अंशुल कंबोज। बिकॉज़ ऑफ़ हिज़ परफॉर्मेंस एंड जस्ट डोंट डोंट गेट इंटू द परफॉर्मेंस पार्ट ओनली। बट मुंबई इस तरह के गेंदबाजों पर ट्रस्ट करता है जिसका डोमेस्टिक सीजन अच्छा गया हो। जो एक होम ग्रोन बॉलर हो। लाइक अ रामकृष्ण घोष इज़ अ परफेक्ट एग्जांपल ऑफ़ दैट। एक अच्छा सीजन एंड आपने उनको अपनी टीम में डाला। और इसके साथ-साथ अंशुल कंबोज एक इस तरह के गेंदबाज भी हैं। वाज़ अ वर्क हॉर्स। मतलब ठीक है वो मैनचेस्टर में अनफिट थे नहीं खेल पाए पूरी तरीके से। अनफिट थे या नहीं मुझे नहीं पता। बट ही ही वाज़ नॉट 100% देयर। और मैं वहीं पर था। आई वाज़ देयर इन मैनचेस्टर। तो वो कम से कम मैं साफ तौर पर आपको बता सकता हूं कि दैट वाज़ नॉट द अंशुल कंबोज जिनको हमने लगातार देखा था। और क्योंकि मैं इंडिया ए में भी था यू नो डिफरेंट पार्ट्स ऑफ़ द वर्ल्ड। लेकिन मैंने अंशुल कंबोज को बेहतर गेंदबाजी करते हुए देखा है। सो उस अंशुल कंबोज से मैं खुद को जोड़ नहीं पाया। तो अंशुल कंबोज विल बी द परफेक्ट ऑप्शन अलोंग वि शिवम दुबे बट क्या मुंबई इंडियंस इसको एक्सेप्ट करेगी और क्या चेन्नई सुपर किंग्स इसको देगी? दैट्स गोइंग टू बी द वन मोस्टेंट क्वेश्चन। देन कम्स द कैप्टेंसी पार्ट। व्हाट आई नो एट दिस पॉइंट ऑफ़ टाइम हार्दिक पांड्या को कप्तानी चाहिए। ही नीड्स कैप्टेंसी। ही वांट्स कैप्टेंसी रादर। और अगर कैप्टेंसी चाहिए तो विल सीएसके टिंकर वि रुतुराज गायवाड़ एस फ एस माय सोर्सेस आर कंसर्न? नो। तो यहां पर फिर एक शख्स चीजों को जो है वो पूरी तरीके से बदल सकता है। दैट्स एमएस धोनी। इफ एमएस धोनी इंटू विंस तभी ये सारी चीजें सॉर्टेड हो सकती हैं। आइदर ही हैज़ टू कन्विंस ऋतु और ही हैज़ टू कन्विंस हार्दिक पांड्या। दोनों में से जो मान जाएगा हु विल अंडरस्टैंड एमएस वहां पर बात बन जाएगी। इफ़ नॉट, तो कहानी घूमेगी। कहानी घूमेगी, तो कोलकाता नाइटराइडर्स कैन इज़ली ऑफर अ कैप्टेंसी एंड दे आल्सो नीड समवन एज़ फार एज़ अ बॉलिंग और बैटिंग ऑलराउंडर इज़ कंसर्नड। तो हार्दिक पांड्या दोनों रोल प्ले करते हैं। कैप्टेन भी हैं बढ़िया हो जाएगा। सिमिलर थिंग विथ डीसी। ऋषभ पंत जितना मुझे पता है। यू नो ही हैज़ डिनाइड कैप्टेंसी। ही डजंट वांट कैप्टेंसी जितना मुझे पता है। एस पर माय सोर्सेस। एंड देन ऑब्वियसली अक्षर पटेल इज़ देयर एंड के एल राहुल इज़ देयर। बट व्हाट आई नो इट्स इट्स के एल राहुल वास द फ्रंट रनर एट दिस पॉइंट ऑफ़ टाइम। आगे चलकर क्या होता है वी विल सी बट एट दिस पॉइंट ऑफ़ टाइम इट इज के एल राहुल। सो ये भी बहुत इंटरेस्टिंग पार्ट है। बट के एल राहुल के साथ अगर आपने हार्दिक पांड्या को भी इस टीम में एंटर करवा दिया देन द कन्वर्सेशंस विल बी रियली इंटरेस्टिंग। क्योंकि फिर ये दोनों या तीनों ऑप्शंस ऐड अक्षर पटेल देयर इज अ के एल राहुल देयर इज अ हार्दिक पांड्या एंड हार्दिक पांड्या की बात जो है ना वो टॉप हायरार्की में हुई है दिल्ली कैपिटल्स के यू नो कब हुई है किससे हुई है किसने इनिशिएट किया क्या किया लेट्स नॉट गो इंटू यू नो गेट इंटू दिस ऑल ऑफ़ दैट बट यस बातचीत हुई है और उस बातचीत ने आपको एक जिस दी है कि इस कॉन्वर्सेशन को हम इतना लाइटली नहीं ले सकते दैट्स सिमिलर थिंग हैव हैपन ड्यूरिंग द ऋषभ पंत टाइम ऋषभ पंत ड्यूरिंग आईपीएल आईपीएल जब चल रहा था उसके आसपास भी ऑलरेडी एक से दो कॉल्स हो चुकी थी बिटवीन द टॉप मैनेजमेंट टॉप हरार्की एंड ऋषभ पंत दैट्स व्हाई कोलकाता नाइट राइडर्स ऑब्वियसली विथ देयर डिमांड्स आल्सो कि हमें रिंकू सिंह दे दो या सुनील नारायण और वरुण चक्रवर्ती में से कोई एक दे दो बट द मोस्टेंट पार्ट इज़ कि आपने देर कर दी ऋषभ पंत को अप्रोच करने में हुआ क्या दैट तब तक तो दिल्ली कैपिटल्स के साथ बात बन गई थी सो अगर हार्दिक पांड्या वहां पर भी आते हैं तो इट विल बी एन इंटरेस्टिंग टेक कि कैप्टेंसी किस तरफ और कैसे जाती है। दैट्स व्हाई आई एम सेइंग कि चेन्नई सुपर किंग्स जो ऑफर कर रही है मुंबई को क्या मुंबई वो एक्सेप्ट करेगी? और अगर मुंबई वो एक्सेप्ट कर लेती है उसके बावजूद भी कैप्टेंसी वाले पार्ट का क्या होगा? विल हार्दिक अग्रीस टू दैट कि नहीं आई विल प्ले अंडर ऋतु? इफ नॉट देन विल सीएसके मैनेजमेंट और एमएस धोनी कैन मेक अ यू नो इंटरवेंशन एंड मेक बोथ द पार्टीज अंडरस्टैंड कि ये चेन्नई सुपर किंग्स के लिए व्हाट इजेंट आइदर रुतू ऋतु हैव टू सेटल डाउन और हार्दिक हैव टू सेटल डाउन वो यह करेंगे देन ओनली इट विल हैपन द अदर पार्ट इज कि क्या इफ नॉट हियर देन द केकेआर पार्ट और देन द डीसी पार्ट एंड आई एम वेरी श्योर डैम श्योर दैट देयर आर देयर आर वन और टू टीम्स हु आर स्टिल वेरी क्वाइट ऑन दिस मैटर बट दे विल जंप इन व्हेन द टाइम विल राइट दे विल जंप इन आई एम वैरी श्योर सो देखते हैं चीजें किस तरीके से आगे बढ़ती है ये पूरा का पूरा मैटर नाउ द लास्ट पार्ट द कैंप थिंग व्हिच आई एम व्हिच आई हैव बीन टोल्ड कि कैंप ना इट्स ऑब्वियसली अबाउट फर्स्ट थिंग कि व्हाट द प्लेयर इज़ एक्चुअली डूइंग ऐसा तो नहीं है कि आईपीएल खत्म हुआ 2 महीने प्लेयर आराम कर रहा है। क्रिकेट का टच भूल गया पूरी तरीके से। मतलब क्रिकेट ही नहीं खेल रहा है। दो महीना मस्ती कर रहा है। जीत कर गया है या एक अच्छा सीजन उसका हुआ है। तो जीत कर गया है। अमूमन तौर पर इन कैंप्स में फ्रेंच प्लेयर्स को आप बुलाते हो। द प्लेयर्स जिनके फ्यूचर को लेकर के आपको कॉल लेनी है। द प्लेयर्स हु आर फ्री एट दिस पॉइंट ऑफ़ टाइम। द प्लेयर्स हु जिनको लेकर के आपको यह लगता है कि हां यार इनको लेकर के या तो हमें बात करनी है अगले सीजन को लेकर के या फिर हमें इनको चेक करना है अगले सीजन को लेकर के। अब अगले सीजन को लेकर के इसलिए भी चेक करना हो सकता है कि आपको अपने साथ जोड़कर रखना है। लाइक अ कार्तिक शर्मा हु हैज़ डन रियली वेल। सेंटर ऑफ एक्सीलेंस में उसने तीन हाफ सेंचुरी मारी है जिसमें एक 90 है, एक 60 है, एक 50 है। कमाल का बंदा है। मैं आपको अगेन कह रहा हूं ही विल प्ले इंडिया इन नेक्स्ट टू इयर्स। इस बात को आप लिख कर ले लो। सो अ प्लेयर लाइक हिम। आप देखना चाहते हो क्या कर रहा है। बिकॉज़ दैट्स योर इन्वेस्टमेंट। 14 करोड़ आपने खर्च किए हैं। नाउ समवन लाइक यू नो अ प्लेयर लाइक अगर आप शिवम दुबे को बुलाते हो इस समय। आई डोंट नो व्हाट्स द प्लान फॉर हिम एस फार एस सीएसके इज कंसर्न बट यू वांट टू सी कि क्या टच है कैसे खेल रहा है क्या चल रहा है ऑब्वियसली वो इंडिया के लिए खेल ही रहा है तो आप वो भी देख रहे होंगे बट सपोज सपोज अ सरफराज खान लाइक अ सरफराज खान यू वांट टू एक्चुअली सी कि व्हाट एक्सैक्टली ही इज़ डूइंग अगर वो आपके पार्ट ऑफ़ पॉलिसी में है फॉर द नेक्स्ट सीजन यू विल गिव अ डिटेल्ड रिपोर्ट कि हां यार फिट है बंदा बढ़िया कर रहा है बैटिंग भी कर रहा है विजय हज़ारे के लिए प्रिपेयर कर रहा है एवरीथिंग यू वांट टू गिव द अदर पार्ट विल बी कि अगर आपको आपके प्लांस में वो नहीं है तो आप उसको कम्युनिकेट करोगे दैट दिस इज व्हाट वी आर थिंकिंग एंड यू नो बट जस्ट एन एग्जांपल ये प्लीज आप मेरे नाम पे मत चला दीजिएगा कि सरफराज खान इज़ नॉट पार्ट ऑफ़ सीएसके जस्ट एन एग्जांपल मैंने आपको बोला कि ऐसा आप देख रहे हैं आयुष मात्रे अभी तक सेंटर ऑफ एक्सीलेंस में है व्हाट एक्सक्टली द इंजरी आइदर दे विल टॉक क्योंकि वो आ तो नहीं पाएगा वहां पे। सो दीज़ ऑल थिंग्स एंड द कमराडरी एवरीथिंग यू नो वो जेलिंग अप वाला कि भाई चलो जो भी आए यंग प्लेयर्स आए चलो इनको एक साथ रखते हैं एक-द दिन एंड जस्ट जस्ट एक माहौल देते हैं इनको और फिर ये पता भी करेंगे बात भी करेंगे सारी चीजें होंगी। सो बॉन्डिंग भी हो जाती है एंड देन अब फ्यूचर जो गोल्स हैं आपके उनको भी आप उनके साथ क्लियर कर देते हो। सो दैट एकैक्टली हैपेंस दैट व्हाट्स यू नो हैपन। सो दिस इज ऑल अबाउट यू नो एस फार एस चेन्नई सुपर किंग्स इज कंसर्न द ट्रेड्स आर कंसर्न द हार्दिक पांड्या थिंग इज कंसर्न एंड ऑब्वियसली व्हाट्स गोइंग ऑन इन दिल्ली इंटरेस्टिंग डेवलपमेंट्स फॉर मुंबई आल्सो बट मैं वो कभी और शेयर करूंगा आप लोगों के साथ अराउंड हु एक्चुअली दे आर दे आर एक्चुअली लुकिंग एट रिलीज़ यू नो द प्लेयर्स दे वांट टू रिलीज़ इसके अलावा किनको रिलीज़ करना चाह रहे हैं कैप्टेंसी की रेस में कौन सबसे आगे है व्हाट्स गोइंग ऑन विथ सूर्य कुमार यादव वी विल गेट दैट इनू डिटेल बट अभी के लिए फिलहाल इतना अगेन कह रहा हूं। प्लीज लाइक, शेयर, सब्सक्राइब, हिट दैट नोटिफिकेशन बेल, शेयर वि योर फ्रेंड्स। नाउ यू कैन कमेंट एंड टेल मी व्हाट एक्जेक्टली यू थिंक अराउंड ऑल ऑफ दी सिनेरियोस। डू नॉट फॉरगेट टू जॉइन द Telegram ग्रुप एंड डू नॉट फॉरगेट टू हिट द फॉलो बटन इन Instagram बिकॉज़ Instagram एंड Telegram आर द प्लेसेस वेयर यू गेट द न्यूज़। यू नो दैट्स द प्रायोरिटी। एंड देन वी विल कम टू ऑल ऑफ़ द प्लेटफॉर्म्स। सो डू मेक श्योर यू लाइक एंड शेयर। एंड या थैंक यू सो मच।`;

    if (isBlockedCAHeadline(fullText)) {
      console.log(
        `⏭️ Skipping blocked-pattern article (body match): ${parsed.headline}`,
      );
      STATE.ca.seen[cleanLink] = Date.now();
      await saveState(STATE, "blocked content pattern found in body");
      return false;
    }

    let articleType = "player_form";
    try {
      articleType = await classifyArticle(fullText);
    } catch (err) {
      console.warn("⚠️ classifyArticle failed, using default:", err?.message);
    }

    let decision = null;
    try {
      decision = await judgeNewsContext({
        articleText: fullText,
        existingContexts:
          STATE.dailyContext?.contexts?.map((c) => c.summary) || [],
      });

      console.log(
        `📊 Scores — significance: ${
          decision?.significanceScore ?? "n/a"
        }, virality: ${decision?.viralityScore ?? "n/a"} — "${
          parsed.headline
        }"`,
      );

      if (decision?.isAlreadyCovered && decision?.confidence >= 0.8) {
        console.log("🔴 CA skipped — already covered context");
        STATE.ca.seen[cleanLink] = Date.now();
        await saveState(STATE, "duplicate context skipped");
        return false;
      }
    } catch (err) {
      console.warn("⚠️ judgeNewsContext failed:", err?.message || err);
    }

    // ── Step 3: Tweet generation ──────────────────────────────────────────────
    let tweetText = null;
    let generatedPath = null;

    try {
      const { tweetText: tweetToPost, card } =
        await generateClaudeTweetWithType(fullText, articleType);

      tweetText = tweetToPost;

      if (card) {
        try {
          generatedPath = await generateCardImage(
            CREX_BASE_IMAGE_TEMPLATE,
            card,
          );

          console.log("Claude generatedPath:::", generatedPath);
        } catch (err) {
          console.error("❌ Image generation failed:", err);
        }
      } else {
        console.log("📝 Text-only tweet (no card)");
      }
    } catch (err) {
      console.warn("⚠️ Claude failed:", err?.message || err);
    }

    if (!tweetText || tweetText.trim().length < 30) {
      try {
        const { tweetText: gptTweet, card } = await generateGPTTweetWithType(
          fullText,
          articleType,
        );
        tweetText = gptTweet;

        if (card) {
          try {
            generatedPath = await generateCardImage(
              CREX_BASE_IMAGE_TEMPLATE,
              card,
            );

            console.log("GPT generatedPath:::", generatedPath);
          } catch (err) {
            console.error("❌ Image generation failed:", err);
          }
        } else {
          console.log("📝 Text-only tweet (no card)");
        }
      } catch (err) {
        console.warn("⚠️ GPT failed:", err?.message || err);
      }
    }

    if (!tweetText || tweetText.length < 30) {
      STATE.ca.seen[cleanLink] = Date.now();
      await saveState(STATE, "tweet generation failed or too short");
      return false;
    }

    // ── Image check ───────────────────────────────────────────────────────────
    const imageUrl = parsed.imageUrl || null;
    const { useImage } = await decideImageUsage({
      imageUrl,
      usedImages: STATE.usedImages,
    });

    tweetText = applySourceSignature(tweetText, "CA");
    tweetText = tweetText.trim().replace(/\.?$/, ".");

    const tweetId = `CA:${cleanLink}`;

    enqueueTweet({
      id: tweetId,
      source: "CA",
      text: tweetText,
      imageUrl: generatedPath || null,
      seenKey: cleanLink,
      publishedAt: pubMs || Date.now(),
    });

    console.log(`📥 Queued CA tweet: ${parsed.headline}`);

    STATE.ca.seen[cleanLink] = Date.now();

    if (useImage && imageUrl) {
      STATE.usedImages[imageUrl] = Date.now();
    }

    if (decision?.newContext && !contextExists(STATE, decision.newContext)) {
      STATE.dailyContext.contexts.push({
        summary: decision.newContext,
        source: "CA",
        link: cleanLink,
        createdAt: new Date().toISOString(),
      });
    }

    await saveState(STATE);
    console.log(`✅ CA published: ${parsed.headline}`);
    return true;
  } catch (err) {
    console.warn("⚠️ CA processing failed:", err?.message || err);
    return false;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getPubDate(item) {
  const d = item?.pubDate || item?.publishedAt;
  return d ? new Date(d).getTime() : 0;
}

function pruneSeen(STATE, retentionMs) {
  try {
    const now = Date.now();
    let pruned = 0;

    for (const [link, ts] of Object.entries(STATE.ca?.seen || {})) {
      if (now - ts > retentionMs) {
        delete STATE.ca.seen[link];
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old CA seen entries`);
      return true;
    }
  } catch (err) {
    console.warn("⚠️ CA seen prune failed:", err?.message || err);
  }
  return false;
}

function pruneDailyContext(STATE, retentionMs) {
  try {
    const ctx = STATE.dailyContext?.contexts;
    if (!Array.isArray(ctx) || ctx.length === 0) return false;

    const now = Date.now();
    const before = ctx.length;

    STATE.dailyContext.contexts = ctx.filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return Number.isFinite(t) && now - t <= retentionMs;
    });

    const after = STATE.dailyContext.contexts.length;

    if (before !== after) {
      console.log(`🧹 Pruned ${before - after} old dailyContext entries`);
      return true;
    }
  } catch (err) {
    console.warn("⚠️ dailyContext prune failed:", err?.message || err);
  }
  return false;
}

function pruneUsedImages(STATE, retentionMs) {
  try {
    const now = Date.now();
    let pruned = 0;

    for (const [imgUrl, ts] of Object.entries(STATE.usedImages || {})) {
      if (now - ts > retentionMs) {
        delete STATE.usedImages[imgUrl];
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`🧹 Pruned ${pruned} old usedImages entries`);
      return true;
    }
  } catch (err) {
    console.warn("⚠️ usedImages prune failed:", err?.message || err);
  }
  return false;
}

async function decideImageUsage({ imageUrl, usedImages }) {
  if (!imageUrl)
    return { useImage: false, reason: "🖼️ No imageUrl — text-only" };

  if (usedImages?.[imageUrl]) {
    return {
      useImage: false,
      reason: "🖼️ Image already used — forcing text-only",
    };
  }

  try {
    const localImagePath = await downloadImageToTemp(imageUrl);
    const ocrResult = await isRiskyTwitterImage(localImagePath);

    if (!ocrResult?.risky) return { useImage: true, reason: "" };

    return {
      useImage: false,
      reason: `⚠️ OCR flagged image as risky: ${ocrResult.reason || "unknown"}`,
    };
  } catch (err) {
    return {
      useImage: false,
      reason: `⚠️ OCR check failed, fallback to text-only: ${
        err?.message || err
      }`,
    };
  }
}

function contextExists(STATE, summary) {
  if (!STATE.dailyContext?.contexts?.length) return false;
  const norm = normalizeSummary(summary);
  return STATE.dailyContext.contexts.some(
    (c) => normalizeSummary(c.summary) === norm,
  );
}

function normalizeSummary(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
