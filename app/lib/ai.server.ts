import dotenv from "dotenv";
dotenv.config({ override: true });

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

// ─── Provider Config ─────────────────────────────────────────

type Provider = "anthropic" | "openai";

function getProvider(): Provider {
  const val = process.env.AI_PROVIDER?.toLowerCase();
  if (val === "openai") return "openai";
  return "anthropic"; // default
}

// ─── Singleton Clients ───────────────────────────────────────
// Same pattern as db.server.ts — reuse clients across requests in dev.

let anthropicClient: Anthropic | null = null;
let openaiClient: OpenAI | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY env var");
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY env var");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ─── Unified Generation ──────────────────────────────────────

export interface GenerateOptions {
  systemPrompt: string;
  userMessage: string;
}

export interface GenerateResult {
  text: string;
  provider: string;
}

/**
 * Send a prompt to the configured AI provider and get back raw text.
 * The story engine is responsible for parsing/validating the response.
 */
export async function generateText(
  opts: GenerateOptions
): Promise<GenerateResult> {
  const provider = getProvider();

  if (provider === "anthropic") {
    return generateAnthropic(opts);
  } else {
    return generateOpenAI(opts);
  }
}

// ─── Streaming Generation ────────────────────────────────────

/**
 * Stream text chunks from the configured AI provider.
 * Yields raw text strings as they arrive from the model.
 */
export async function* streamText(
  opts: GenerateOptions
): AsyncGenerator<string> {
  const provider = getProvider();

  if (provider === "anthropic") {
    yield* streamAnthropic(opts);
  } else {
    yield* streamOpenAI(opts);
  }
}

export { getProvider };

// ─── Anthropic ───────────────────────────────────────────────

async function* streamAnthropic(
  opts: GenerateOptions
): AsyncGenerator<string> {
  const client = getAnthropicClient();

  const stream = client.messages.stream({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: opts.systemPrompt,
    messages: [{ role: "user", content: opts.userMessage }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

async function* streamOpenAI(
  opts: GenerateOptions
): AsyncGenerator<string> {
  const client = getOpenAIClient();

  const stream = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1024,
    stream: true,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userMessage },
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) yield text;
  }
}

// ─── Non-Streaming (kept for retry fallback) ─────────────────

async function generateAnthropic(
  opts: GenerateOptions
): Promise<GenerateResult> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: opts.systemPrompt,
    messages: [{ role: "user", content: opts.userMessage }],
  });

  // Extract text from the response content blocks
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return { text, provider: "anthropic" };
}

// ─── OpenAI ──────────────────────────────────────────────────

async function generateOpenAI(
  opts: GenerateOptions
): Promise<GenerateResult> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1024,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userMessage },
    ],
  });

  const text = response.choices[0]?.message?.content ?? "";

  return { text, provider: "openai" };
}
