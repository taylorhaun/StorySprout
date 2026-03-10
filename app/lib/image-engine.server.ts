import dotenv from "dotenv";
dotenv.config({ override: true });

import OpenAI from "openai";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "./db.server.js";

// ─── OpenAI Client (reuse from ai.server.ts pattern) ───────

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY env var");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ─── Style Spines ───────────────────────────────────────────

const VISUAL_STYLE_SPINES: Record<string, string> = {
  "whimsical-rhyme":
    "bright saturated watercolor illustration, playful whimsical composition, warm colors, thick soft outlines, children's picture book style, hand-painted texture, joyful mood",
  "calm-bedtime":
    "soft pastel watercolor illustration, dreamy gentle atmosphere, moonlit tones, muted colors, cozy warm lighting, children's picture book style, peaceful serene mood",
  "silly-goofy":
    "bold colorful cartoon illustration, exaggerated fun expressions, bright primary colors, playful dynamic composition, children's picture book style, silly energetic mood",
};

const DEFAULT_STYLE_SPINE =
  "warm watercolor children's picture book illustration, soft lighting, rounded shapes, gentle colors, simple background";

// ─── Image Generation ───────────────────────────────────────

interface GenerateBeatImageOptions {
  storyId: string;
  beatId: string;
  beatNumber: number;
  segment: string;
  characterDescription: string;
  styleSlug: string;
  themeName: string;
}

/**
 * Generates one illustration for a story beat and saves to disk + DB.
 */
export async function generateBeatImage(
  opts: GenerateBeatImageOptions
): Promise<{ imageUrl: string }> {
  const styleSpine =
    VISUAL_STYLE_SPINES[opts.styleSlug] ?? DEFAULT_STYLE_SPINE;

  const characterPrompt = opts.characterDescription
    ? `Character: ${opts.characterDescription}. `
    : "";

  const prompt = `${characterPrompt}Children's picture book illustration of a ${opts.themeName.toLowerCase()} story: ${summarizeForImage(opts.segment)}. ${styleSpine}`;

  const imageBuffer = await generateImage(prompt);

  // Save to disk
  const dir = path.join(
    process.cwd(),
    "public",
    "images",
    "stories",
    opts.storyId
  );
  await mkdir(dir, { recursive: true });

  const filename = `beat-${opts.beatNumber}.png`;
  await writeFile(path.join(dir, filename), imageBuffer);

  const imageUrl = `/images/stories/${opts.storyId}/${filename}`;

  // Update the beat record with image URL
  await prisma.storyBeat.update({
    where: { id: opts.beatId },
    data: { imageLeftUrl: imageUrl },
  });

  return { imageUrl };
}

// ─── OpenAI GPT Image 1 Mini ────────────────────────────────

async function generateImage(prompt: string): Promise<Buffer> {
  const client = getOpenAIClient();

  const response = await client.images.generate({
    model: "gpt-image-1-mini",
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "low",
  });

  const imageData = response.data?.[0];
  if (!imageData || !("b64_json" in imageData) || !imageData.b64_json) {
    throw new Error("No image data returned from OpenAI");
  }

  return Buffer.from(imageData.b64_json, "base64");
}

// ─── Character Description Extractor ────────────────────────

/**
 * Extracts a visual character description from the first beat's text.
 * Used for consistent character prompting across all beats.
 */
export function extractCharacterPrompt(beatOneSegment: string): string {
  return beatOneSegment;
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Truncates and cleans story text for use in image prompts.
 * Image models work best with concise, descriptive prompts.
 */
function summarizeForImage(segment: string): string {
  const cleaned = segment.replace(/\n/g, " ").trim();
  if (cleaned.length <= 150) return cleaned;
  return cleaned.slice(0, 150).replace(/\s+\S*$/, "") + "...";
}
