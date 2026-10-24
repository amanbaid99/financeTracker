// Output checks on AI text: no named funds, fund houses or brands, and no em dashes.

const CATEGORY_WORDS = new Set(
  [
    "liquid",
    "index",
    "equity",
    "debt",
    "hybrid",
    "flexi-cap",
    "flexi",
    "cap",
    "large-cap",
    "mid-cap",
    "small-cap",
    "short-duration",
    "duration",
    "balanced",
    "advantage",
    "conservative",
    "aggressive",
    "overnight",
    "money",
    "market",
    "elss",
    "sweep",
    "emergency",
    "gold",
    "mutual",
    "a",
    "an",
    "the",
    "this",
    "that",
    "your",
    "any",
    "one",
    "each",
    "low-cost",
    "passive",
    "tax",
    "saver",
    "savings",
    "other",
  ].map((w) => w.toLowerCase()),
);

// "<Brandname> Mutual Fund", "<Brand> AMC", "<Brand> Bluechip Fund" style phrases.
const NAMED_PRODUCT = /\b([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,3})\s+(Mutual Fund|Fund|AMC|Asset Management|Securities|Life Insurance|General Insurance|Bank)\b/g;

export function findNamedProducts(text: string): string[] {
  const hits: string[] = [];
  for (const m of text.matchAll(NAMED_PRODUCT)) {
    const words = m[1].split(/\s+/);
    if (words.every((w) => CATEGORY_WORDS.has(w.toLowerCase()))) continue;
    hits.push(m[0]);
  }
  return hits;
}

export function cleanOutput(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
