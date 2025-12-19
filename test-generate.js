// import { generateBBCNewsTweet } from "../generateBBCNewsTweet.js";

// import { generateViralTweet } from "../common-ai/generate-viral-tweet.js";
// import { generateViralTweet } from "./common-ai/generate-viral-tweet.js";
import { generateIENewsTweet } from "./indian-express/ai/generateIENewsTweet.js";

const SAMPLE_BODY = `Ishan Kishan last played a T20I for India in November 2023. In the two years since, he has seen the likes of Sanju Samson and Jitesh Sharma move ahead of him in the wicketkeepers’ pecking order in Indian cricket.
On Thursday, the 27-year-old Jharkhand captain gave a resounding reminder of what he could still do with the bat, slamming 101 off 49 balls to play a pivotal role in Jharkhand beating Haryana by 69 runs to win the 2025-26 Syed Mushtaq Ali Trophy (SMAT) – their maiden title – in Pune.
Following the trend where four out of the six matches at the Gahunje stadium were won by the team batting second in the Super League, Haryana captain Ankit Kumar won the toss and put Jharkhand into bat.
Time for celebration in the Jharkhand camp as they win the Syed Mushtaq Ali Trophy for the first time 🙌
Scorecard ▶️ https://t.co/3fGWDCTjoo#SMAT | @IDFCFIRSTBank pic.twitter.com/qJB0b2oS0Y
— BCCI Domestic (@BCCIdomestic) December 18, 2025
When Anshul Kamboj removed Virat Singh for two runs in the first over, it seemed like the right call. But that would prove to be their only moment of joy for the next 13-odd overs as Kamboj and the rest of the Haryana attack lost their lengths spectacularly.
Kishan, along with Kumar Kushagra, made full use of the mediocre bowling on display, carting the attack to all parts of the ground. He got his half-century off 24 balls and became the second batter to score a hundred in a SMAT final, bringing up the landmark off 45 balls, with a one-handed six off Kamboj. Kishan smashed 10 sixes, five of which cleared the long-on fence.
The Jharkhand skipper took a special liking for off-spinner Amit Rana, scoring 36 runs off 11 balls with four sixes. The left-hander also took Kamboj to the cleaners, scoring 27 runs off 13 balls with two fours and two sixes.
Jharkhand Captain Ishan Kishan receives the coveted Trophy from BCCI Hon. Treasurer Mr. A. Raghuram Bhat 🏆👏
Scorecard ▶️ https://t.co/3fGWDCTjoo#SMAT | @IDFCFIRSTBank | @ishankishan51 pic.twitter.com/KoEhrdwPB3
— BCCI Domestic (@BCCIdomestic) December 18, 2025
The left-hander’s exploits was matched by Kushagra, who ensured that the Haryana attack did not breathe easy at the other end. The right-hander, who had played a central role in Jharkhand breaking the record for the biggest chase in the tournament’s history against Punjab last week, smashed 81 off 38 balls, filled with eight fours and five sixes.
The pair put on 177 runs in 82 deliveries for the second wicket to lay the foundation for a mammoth score. The finishing touches was added by Anukul Roy and Robin Minz, who ransacked 75 runs off 29 balls for the fourth wicket to take Jharkhand to 262/3 in 20 overs – the highest score in a SMAT final, going past Punjab’s 223/4 against Baroda in the 2023-24 finale.
He too brings up a brisk FIFTY in the final 👏
Updates ▶️ https://t.co/3fGWDCTjoo@IDFCFIRSTBank pic.twitter.com/PzxD2cahvL
— BCCI Domestic (@BCCIdomestic) December 18, 2025
“Looking at the tournament, we were going for the big shots even if we lose wickets, unfortunately we lost Virat early, but we were looking to score runs. It is difficult to chase in a final. KK made it easier for me, he was scoring freely and confidently from the other end. That’s the plus point, we had a chat at the beginning, to bat freely. It was a very good pitch to bat on especially in the first innings and it helped us put such a big total on the board. Lot of support from the supporting staff, if any batter was not doing well then they were there cheering him on, it was a pretty good tournament for us,” Kishan said after the victory on Thursday.
Ishan Kishan with a magnificent hundred in the #SMAT final 💯
The Jharkhand captain walks back for 1⃣0⃣1⃣(49) 👏
Updates ▶️ https://t.co/3fGWDCTjoo@IDFCFIRSTBank | @ishankishan51 pic.twitter.com/PJ7VI752wp
— BCCI Domestic (@BCCIdomestic) December 18, 2025
Haryana had a huge mountain to climb in their chase, but their attempt to track the score down got off to a disastrous start as pacer Vikash Singh dismissed the in-form Kumar and number three batter Ashish Siwach for ducks in the first over.
Yashvardhan Dalal and Nishant Sindhu tried their best to keep up with the ever-increasing asking rate, putting on 67 runs off 27 balls for the fourth wicket. But just when it seemed like they had settled in for the long haul, Roy dismissed both batters off the first and the third deliveries of the 10th over to dent their chances significantly.
2⃣ wickets in the first over for Vikash Singh and Jharkhand 👏
Updates ▶️ https://t.co/3fGWDCTjoo#SMAT | @IDFCFIRSTBank pic.twitter.com/8yHlYFWQmA
— BCCI Domestic (@BCCIdomestic) December 18, 2025
The Haryana lower-order tried their best to keep the flame burning, but Jharkhand eventually closed out the match and clinched their maiden SMAT trophy in their first final – fittingly sealed by their captain’s statement knock.
Brief Scores: Jharkhand 262/3 in 20 overs (Kishan 101, Kushagra 81) beat Haryana 193 in 18.3 overs (Dalal 53, Jakhar 38; Mishra 3/27, Krishna 3/38).
Stay updated with the latest sports news across Cricket, Football, Chess, and more. Catch all the action with real-time live cricket score updates and in-depth coverage of ongoing matches.
`;

async function runTest() {
  try {
    // const tweet = await generateViralTweet(SAMPLE_BODY, 240);
    const tweet = await generateIENewsTweet(SAMPLE_BODY);

    console.log("✅ AI Tweet Output:");
    console.log(tweet);
  } catch (err) {
    console.error("❌ TEST FAILED:", err.message);
  }
}

runTest();
