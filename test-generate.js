// import { generateBBCNewsTweet } from "../generateBBCNewsTweet.js";

// import { generateViralTweet } from "../common-ai/generate-viral-tweet.js";
import { generateViralTweet } from "./common-ai/generate-viral-tweet.js";

const SAMPLE_BODY = `India vs Sri Lanka U19 Asia Cup 2025 Semi Final Live Cricket Score Updates: The toss for the India vs Sri Lanka game in the semi-finals of the U19 Asia Cup has been delayed due to rain and a wet outfield in Dubai. Scenes from Dubai show massive puddles around the boundary ropes at the ICC Academy Ground.

The next inspection will be at 11 am local time (12.30 pm in India)! The cut-off time for at least a 20-over match is 2.02 local time (3.30 am IST).

Story continues below. Subscribe to see fewer ads.

The Indian cricket team is facing off against Sri Lanka today in the semi-final of the U19 Asia Cup 2025 while Pakistan are simultaneously taking on Bangladesh in the other semi-final setting the stage for a prospective India vs Pakistan clash in the final. All eyes will be players like Vaibhav Suryavanshi and captain Ayush Mhatre.

The two arch-rivals, India and Pakistan, have already faced off once in the group stage, with India defeating Pakistan on their way to an unbeaten run into the semi-finals.

India U19 squad:
Ayush Mhatre (c), Abhigyan Kundu (wk), Vaibhav Suryavanshi, Vihaan Malhotra, Vedant Trivedi, Harvansh Pangalia, Kanishk Chouhan, Khilan Patel, Deepesh Devendran, Udhav Mohan, Kishan Kumar Singh, Naman Pushpak, Henil Patel, Aaron George, Yuvraj Gohil

Sri Lanka U19 squad:
Vimath Dinsara (c), Aadham Hilmy (wk), Dimantha Mahavithana, Viran Chamuditha, Kithma Withanapathirana, Kavija Gamage, Chamika Heenatigala, Dulnith Sigera, Sethmika Seneviratne, Rasith Nimsara, Tharusha Navodya, Mathulan Kugathas, Vigneshwaran Akash, Tharusha Nethsara, Sanuja Ninduwara

Scroll down for all the updates in real-time from India’s semi-final
`;

async function runTest() {
  try {
    const tweet = await generateViralTweet(SAMPLE_BODY, 240);

    console.log("✅ AI Tweet Output:");
    console.log(tweet);
  } catch (err) {
    console.error("❌ TEST FAILED:", err.message);
  }
}

runTest();
