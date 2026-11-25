export const IS_PDF_ENABLE =
  String(process.env.is_pdf_enable ?? "false")
    .trim()
    .toLowerCase() === "true";

export const PDF_PLACEHOLDER_TEXT = "Article only. Draft it from the file.";

const FRANCHISE_NAMES =
  /\b(Chennai Super Kings|Mumbai Indians|Royal Challengers)\b/i;
const FRANCHISE_ABBR = /\b(CSK|MI|RCB)\b/;

// PDF mode replacement for the classifier's exempt check (MI, CSK, RCB skip the score gate)
export function isFranchiseExempt(headline = "", fullText = "") {
  const scope = `${headline} ${fullText.slice(0, 500)}`;
  return FRANCHISE_NAMES.test(scope) || FRANCHISE_ABBR.test(scope);
}
