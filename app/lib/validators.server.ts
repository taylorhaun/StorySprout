import { z } from "zod";

// ─── Zod Schema for AI Response ──────────────────────────────

/**
 * The shape we expect the AI to return for each beat.
 * Beats 1-4 must have a question + 2 options.
 * Beat 5 has no question and empty options.
 */
export const BeatResponseSchema = z.object({
  beat: z.number().int().min(1).max(5),
  segment: z.string().min(1),
  question: z.string().nullable(),
  options: z.array(z.string()),
});

export type BeatResponse = z.infer<typeof BeatResponseSchema>;

// ─── Structural Validation ───────────────────────────────────

/**
 * Validates the structural correctness of a beat response
 * beyond what Zod checks — e.g., beat 1-4 must have question + 2 options,
 * beat 5 must not.
 */
export function validateBeatStructure(
  data: BeatResponse,
  expectedBeat: number
): string | null {
  if (data.beat !== expectedBeat) {
    return `Expected beat ${expectedBeat}, got beat ${data.beat}`;
  }

  if (expectedBeat < 5) {
    if (!data.question) {
      return `Beat ${expectedBeat} must include a question`;
    }
    if (data.options.length !== 2) {
      return `Beat ${expectedBeat} must have exactly 2 options, got ${data.options.length}`;
    }
  }

  if (expectedBeat === 5) {
    if (data.question) {
      return "Beat 5 should not have a question";
    }
    if (data.options.length > 0) {
      return "Beat 5 should not have options";
    }
  }

  // Word count check: 80-120 words (with some tolerance — allow 40-160)
  const wordCount = data.segment.split(/\s+/).filter(Boolean).length;
  if (wordCount < 40) {
    return `Segment too short: ${wordCount} words (minimum 40)`;
  }
  if (wordCount > 160) {
    return `Segment too long: ${wordCount} words (maximum 160)`;
  }

  return null; // all good
}

// ─── Content Safety ──────────────────────────────────────────

/**
 * Words/phrases that should never appear in content for 3-5 year olds.
 * This is a backup safety layer — the primary safety is in the prompt.
 */
const BLOCKED_WORDS = [
  // Fear & danger
  "scary",
  "terrified",
  "horror",
  "nightmare",
  "monster",
  "ghost",
  "demon",
  "witch",
  "evil",
  "wicked",
  "creepy",
  "haunted",
  "scream",
  "shriek",
  // Violence
  "kill",
  "murder",
  "blood",
  "weapon",
  "sword",
  "gun",
  "fight",
  "attack",
  "destroy",
  "punch",
  "stab",
  "wound",
  "hurt",
  "pain",
  // Death & sadness
  "death",
  "dead",
  "die",
  "dying",
  "funeral",
  "grave",
  "cry",
  "crying",
  "tears",
  "sob",
  // Darkness & isolation
  "alone",
  "abandoned",
  "lost",
  "trapped",
  "prison",
  "dungeon",
  "dark",
  "darkness",
  // Adult content
  "stupid",
  "hate",
  "ugly",
  "dumb",
  "idiot",
  "fat",
  "loser",
];

/**
 * Checks the segment text (and options) for blocked words.
 * Returns the first blocked word found, or null if safe.
 */
export function checkContentSafety(data: BeatResponse): string | null {
  const textToCheck = [
    data.segment,
    data.question ?? "",
    ...data.options,
  ]
    .join(" ")
    .toLowerCase();

  for (const word of BLOCKED_WORDS) {
    // Match whole words only to avoid false positives
    // e.g., "painting" shouldn't match "pain"
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(textToCheck)) {
      return word;
    }
  }

  return null;
}

// ─── Parse + Validate Pipeline ───────────────────────────────

export interface ValidationResult {
  success: true;
  data: BeatResponse;
}

export interface ValidationError {
  success: false;
  error: string;
}

/**
 * Full validation pipeline: parse JSON → Zod schema → structure → safety.
 * Returns either the validated data or an error message.
 */
export function validateBeatResponse(
  raw: string,
  expectedBeat: number
): ValidationResult | ValidationError {
  // 1. Parse JSON
  let parsed: unknown;
  try {
    // Strip markdown code fences if the AI wraps its response
    const cleaned = raw
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return { success: false, error: `Invalid JSON: ${raw.slice(0, 200)}` };
  }

  // 2. Zod schema validation
  const zodResult = BeatResponseSchema.safeParse(parsed);
  if (!zodResult.success) {
    const issues = zodResult.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return { success: false, error: `Schema validation failed: ${issues}` };
  }

  // 3. Structural validation
  const structError = validateBeatStructure(zodResult.data, expectedBeat);
  if (structError) {
    return { success: false, error: structError };
  }

  // 4. Content safety
  const unsafeWord = checkContentSafety(zodResult.data);
  if (unsafeWord) {
    return {
      success: false,
      error: `Content safety violation: blocked word "${unsafeWord}"`,
    };
  }

  return { success: true, data: zodResult.data };
}
