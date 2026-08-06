import { GoogleDecoder } from "google-news-url-decoder";

const decoder = new GoogleDecoder();

export async function resolveGoogleNewsUrl(googleNewsUrl) {
  if (!googleNewsUrl) {
    return null;
  }

  try {
    const result = await decoder.decode(googleNewsUrl);

    console.log("Google News decoder result:", result);

    if (result?.status && result?.decoded_url) {
      return result.decoded_url;
    }

    return null;
  } catch (error) {
    console.error(
      "Google News URL decode failed:",
      error instanceof Error ? error.message : error,
    );

    return null;
  }
}

export default resolveGoogleNewsUrl;
