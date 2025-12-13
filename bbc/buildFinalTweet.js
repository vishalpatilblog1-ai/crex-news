export function buildFinalTweet(aiText, url) {
  return `${aiText.trim()}\n\n📰 BBC Sport\n🔗 ${url}`;
}
