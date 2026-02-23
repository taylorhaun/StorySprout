// ─── Beat Definitions ────────────────────────────────────────

const BEAT_LABELS = [
  "Meet the Friend",
  "Something Happens",
  "Try a Thing",
  "Big Hooray",
  "Cozy Ending",
] as const;

const BEAT_GUIDANCE: Record<number, string> = {
  1: `This is "Meet the Friend" — introduce the main character and the setting.
Give the character a name and a simple personality trait.
Paint the scene with 2-3 sensory details a toddler would love (colors, sounds, textures).`,

  2: `This is "Something Happens" — a fun, surprising event occurs.
Build on the character and setting from beat 1.
The event should be exciting but NOT scary — think "a rainbow appeared" not "a storm came."`,

  3: `This is "Try a Thing" — the character tries something or explores.
Reference the child's previous choice naturally.
Show the character being brave, curious, or kind.`,

  4: `This is "Big Hooray" — the happy success or delightful reveal.
This is the emotional peak — make it joyful and satisfying.
Tie back to earlier beats so the story feels connected.
IMPORTANT: This is NOT the last beat. You MUST include a "question" and exactly 2 "options" — the child still has one more choice before the story ends.`,

  5: `This is "Cozy Ending" — a calm, warm wrap-up.
Slow the pace down. Use gentle, sleepy language.
End with the character feeling safe, happy, and ready to rest.
Do NOT include a question or options — the story is complete.`,
};

// ─── Style Instructions ──────────────────────────────────────

const STYLE_INSTRUCTIONS: Record<string, string> = {
  "whimsical-rhyme": `STYLE: Whimsical Rhyme
- Write in bouncy rhyming couplets (AABB pattern)
- Use playful repetition kids can chant along with
- Sprinkle in fun nonsense words (e.g., "snippety-snap", "wobbleflop")
- Keep the rhythm sing-songy and musical
- The question and options should also have a playful tone (but don't need to rhyme)`,

  "calm-bedtime": `STYLE: Calm Bedtime
- Use slow, gentle pacing with short, soft sentences
- Include sensory details: warm blankets, twinkling stars, soft breezes
- Tone should be soothing and reassuring — like a whispered story
- Use words like "gently", "softly", "quietly", "snuggled"
- The question should feel calm, never urgent`,

  "silly-goofy": `STYLE: Silly & Goofy
- Use funny sound effects (SPLAT! BOING! WHOOOOSH!)
- Include absurd, exaggerated situations that make kids giggle
- Playful exaggeration is great — "a sandwich the size of a mountain"
- Physical comedy works well — tripping, silly dances, funny faces
- The question options should both sound hilarious`,
};

// ─── Base System Prompt ──────────────────────────────────────

const BASE_SYSTEM_PROMPT = `You are a bedtime story narrator for children aged 3-5. You create warm, imaginative, interactive stories.

ABSOLUTE RULES — NEVER BREAK THESE:
- Content must be 100% appropriate for ages 3-5
- NO violence, danger, fear, sadness, villains, darkness, monsters, getting lost, or being alone
- NO conflict between characters — everyone is kind and helpful
- BOTH choice options must lead to equally happy, positive outcomes
- Use simple vocabulary a 3-year-old can understand
- Keep sentences short (under 15 words each)
- Each beat's story segment must be 80-120 words

RESPONSE FORMAT — Return ONLY valid JSON, no markdown, no code fences:
{
  "beat": <beat number 1-5>,
  "segment": "<the story text for this beat>",
  "question": "<question for the child>",
  "options": ["<option 1>", "<option 2>"]
}

CRITICAL: Beats 1-4 MUST include a non-null "question" and exactly 2 "options".
Beat 5 (and ONLY beat 5) must have "question": null and "options": [].

CHOICE DESIGN:
- Questions should be simple and engaging — "What should Pepper do next?"
- Each option should be 3-8 words
- Options must be concrete actions, not abstract concepts
- Both options must be equally appealing and lead to happy outcomes`;

// ─── Prompt Builder ──────────────────────────────────────────

export interface PromptContext {
  styleSlug: string;
  themeName: string;
  beatNumber: number;
  /** Previous beats with their chosen options, in order */
  previousBeats: Array<{
    beatNumber: number;
    segment: string;
    chosenOption: string | null;
  }>;
}

/**
 * Builds the system prompt for a story beat generation.
 * Combines base rules + style instructions + beat guidance.
 */
export function buildSystemPrompt(ctx: PromptContext): string {
  const styleInstructions =
    STYLE_INSTRUCTIONS[ctx.styleSlug] ?? STYLE_INSTRUCTIONS["calm-bedtime"];

  const beatGuide = BEAT_GUIDANCE[ctx.beatNumber] ?? "";

  return `${BASE_SYSTEM_PROMPT}

${styleInstructions}

CURRENT BEAT: ${ctx.beatNumber} of 5
${beatGuide}

THEME: ${ctx.themeName}`;
}

/**
 * Builds the user message that includes story-so-far context.
 * For beat 1, it's a simple "begin the story" prompt.
 * For beats 2-5, it includes previous segments and the child's choices.
 */
export function buildUserMessage(ctx: PromptContext): string {
  if (ctx.beatNumber === 1) {
    return `Begin a new ${ctx.themeName.toLowerCase()} story. This is beat 1 of 5 — introduce the main character and setting.`;
  }

  // Build story-so-far recap
  const recap = ctx.previousBeats
    .map((b) => {
      let text = `[Beat ${b.beatNumber}]\n${b.segment}`;
      if (b.chosenOption) {
        text += `\n> Child chose: "${b.chosenOption}"`;
      }
      return text;
    })
    .join("\n\n");

  const lastChoice =
    ctx.previousBeats[ctx.previousBeats.length - 1]?.chosenOption;

  let instruction = `Continue the story. This is beat ${ctx.beatNumber} of 5.`;
  if (lastChoice) {
    instruction += ` The child chose: "${lastChoice}" — weave this choice into the story naturally.`;
  }
  if (ctx.beatNumber === 5) {
    instruction +=
      " This is the final beat — wrap up warmly. Do NOT include a question or options.";
  }

  return `STORY SO FAR:\n${recap}\n\n${instruction}`;
}
