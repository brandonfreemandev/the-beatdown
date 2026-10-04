// Pure functions for the moltbook-responder worker: SCHEMA-ask detection and
// the leet-obfuscated math challenge solver. No worker-specific APIs here so
// the solver can be unit-tested with plain tsx/node.

const AGENT_ID = "34b4b124-2f87-4136-8bf2-198864394f5a";

/**
 * Moltbook's anti-spam challenges obfuscate a math word problem by randomly
 * duplicating letters and sprinkling punctuation, e.g.:
 *   "A] lOoObSsTtEeR S^wImS[ aT/ tW~eNtY] tHrEe- cE^nTiMeTeRs/ ..."
 *   -> "a lobster swims at twenty three centimeters per second and gains
 *       seven ... what is the new speed?"  -> 30.00
 * Collapsing consecutive duplicate letters works for the noise ("loobstteer"
 * -> "lobster") but would corrupt real double letters ("three" -> "thre"),
 * so the lexicon below is ALSO stored collapsed and matched that way.
 */
function collapse(word: string): string {
  return word.replace(/(.)\1+/g, "$1");
}

const NUMBER_WORDS: [string, number][] = [
  ["zero", 0], ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5],
  ["six", 6], ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10],
  ["eleven", 11], ["twelve", 12], ["thirteen", 13], ["fourteen", 14],
  ["fifteen", 15], ["sixteen", 16], ["seventeen", 17], ["eighteen", 18],
  ["nineteen", 19], ["twenty", 20], ["thirty", 30], ["forty", 40],
  ["fifty", 50], ["sixty", 60], ["seventy", 70], ["eighty", 80],
  ["ninety", 90], ["hundred", 100], ["thousand", 1000],
];

const NUMBER_LOOKUP = new Map<string, number>(
  NUMBER_WORDS.map(([word, value]) => [collapse(word), value]),
);

// Multiplier words are separate: doubles/triples/halves work without a
// second operand ("and doubles, what is the new speed?").
const UNARY_MULTIPLY_WORDS = ["doubles", "double", "triples", "triple"];
const UNARY_DIVIDE_WORDS = ["halves", "halved", "half"];
const BINARY_MULTIPLY_WORDS = ["times", "multiplied", "multiplies"];
const BINARY_DIVIDE_WORDS = ["divided"];
const PLUS_WORDS = ["gains", "gain", "accelerates", "accelerated", "increases", "increased", "adds", "plus", "rises"];
const MINUS_WORDS = ["loses", "lost", "drops", "dropped", "decelerates", "decelerated", "decreases", "decreased", "slows", "slowed", "minus", "reduces", "reduced", "sheds"];

function matchesAny(text: string, words: string[]): boolean {
  return words.some((w) => new RegExp(`\\b${collapse(w)}\\b`).test(text));
}

/**
 * Detects a bare SCHEMA ask. Deliberately strict: short comments containing
 * the word "schema" (covers "SCHEMA", "schema please", "can I get the
 * schema"). Longer comments mentioning schema in passing are left for the
 * heartbeat, which reads them in context.
 */
export function isSchemaAsk(authorId: string, content: string): boolean {
  if (authorId === AGENT_ID) return false;
  const trimmed = content.trim();
  if (trimmed.length === 0 || trimmed.length > 60) return false;
  const words = trimmed
    .replace(/@[\w.-]+/g, " ")
    .split(/\s+/)
    .filter((w) => /[a-z]/i.test(w));
  if (words.length > 5) return false;
  return words.some((w) => w.replace(/[^a-z]/gi, "").toLowerCase() === "schema");
}

/** Extracts the numbers spoken as words ("twenty three" -> 23). */
function extractWordNumbers(tokens: string[]): number[] {
  // Obfuscation sometimes splits one number word into chunks ("tWeN tY").
  // Rejoin adjacent chunks when their concatenation is a lexicon word but the
  // individual chunks are not ("twen"+"ty" -> "twenty"); keep real words as-is.
  const merged: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const next = tokens[i + 1];
    if (
      next !== undefined &&
      !NUMBER_LOOKUP.has(tokens[i]) &&
      !NUMBER_LOOKUP.has(next)
    ) {
      const combo = tokens[i] + next;
      if (NUMBER_LOOKUP.has(combo)) {
        merged.push(combo);
        i++;
        continue;
      }
    }
    merged.push(tokens[i]);
  }

  const numbers: number[] = [];
  let current = 0;
  let sawAny = false;
  for (const token of merged) {
    const value = NUMBER_LOOKUP.get(token);
    if (value === undefined) {
      if (sawAny) numbers.push(current);
      current = 0;
      sawAny = false;
      continue;
    }
    sawAny = true;
    if (value === 100 || value === 1000) {
      current = (current || 1) * value;
    } else {
      current += value;
    }
  }
  if (sawAny) numbers.push(current);
  return numbers;
}

/**
 * Solves a challenge, returning the answer formatted with exactly 2 decimals
 * ("30.00"), or null when it cannot be solved confidently. null means the
 * worker stays silent and the ZCode heartbeat handles the comment instead.
 */
export function solveChallenge(challengeText: string): string | null {
  const lower = challengeText.toLowerCase();
  const digitNumbers = (lower.match(/\b\d+(?:\.\d+)?\b/g) ?? []).map(Number);
  // Junk punctuation lands INSIDE words ("tW~eNtY"), so tokenize on the real
  // whitespace (which Moltbook preserves) and strip non-letters per chunk.
  const tokens = lower
    .split(/\s+/)
    .map((chunk) => collapse(chunk.replace(/[^a-z]/g, "")))
    .filter(Boolean);
  const collapsed = tokens.join(" ");

  const wordNumbers = extractWordNumbers(tokens);
  const numbers =
    wordNumbers.length >= 2 ? wordNumbers
    : digitNumbers.length >= 2 ? digitNumbers
    : wordNumbers.length > 0 ? wordNumbers
    : digitNumbers;

  // Unary forms must win over their binary cousins ("halves" contains no
  // "divided", but the chain order still matters for doubles/triples).
  let binary: ((a: number, b: number) => number) | null = null;
  let unary: ((a: number) => number) | null = null;
  if (matchesAny(collapsed, UNARY_MULTIPLY_WORDS)) unary = (a) => a * 2; // triples handled below
  else if (matchesAny(collapsed, UNARY_DIVIDE_WORDS)) unary = (a) => a / 2;
  else if (matchesAny(collapsed, MINUS_WORDS)) binary = (a, b) => a - b;
  else if (matchesAny(collapsed, BINARY_MULTIPLY_WORDS)) binary = (a, b) => a * b;
  else if (matchesAny(collapsed, BINARY_DIVIDE_WORDS)) binary = (a, b) => a / b;
  else if (matchesAny(collapsed, PLUS_WORDS)) binary = (a, b) => a + b;
  else if (/\s\+\s/.test(challengeText)) binary = (a, b) => a + b; // bare symbol between numbers
  else if (/\s[-−]\s/.test(challengeText)) binary = (a, b) => a - b;
  else if (/\s[*×xX]\s/.test(challengeText)) binary = (a, b) => a * b;
  else if (/\s[/÷]\s/.test(challengeText)) binary = (a, b) => a / b;
  if (unary && matchesAny(collapsed, ["triples", "triple"])) unary = (a) => a * 3;

  if (binary && numbers.length >= 2) {
    // Fold left when more than two numbers appear ("a gains b and c").
    const [first, ...rest] = numbers;
    const result = rest.reduce((acc, n) => binary!(acc, n), first);
    if (Number.isFinite(result)) return result.toFixed(2);
    return null;
  }
  if (unary && numbers.length === 1) {
    const result = unary(numbers[0]);
    if (Number.isFinite(result)) return result.toFixed(2);
  }
  return null;
}
