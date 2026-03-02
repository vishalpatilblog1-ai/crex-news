// testClaude.js
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function test() {
  const res = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 80,
    messages: [
      {
        role: "user",
        content: "Write a one-line tweet about MS Dhoni's calmness.",
      },
    ],
  });

  console.log(res.content[0].text);
}

test();
