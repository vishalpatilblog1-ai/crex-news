// import { generateMufaStyleAIReply } from "./generateMufaStyleAIReply.js";

import { generateMufaStyleAIReply } from "./auto-reply/generateMufaStyleAIReply.js";

async function test() {
  const sampleTweet = `
  A TEST CENTURY WITH THE SHADES ON. 😎

  - Shai Hope with a 4th innings hundred in NZ.
  `;

  console.log("Original Tweet:");
  console.log(sampleTweet);

  const reply = await generateMufaStyleAIReply(sampleTweet);

  console.log("\nAI MUFA-STYLE REPLY:");
  console.log(reply);
}

test();
