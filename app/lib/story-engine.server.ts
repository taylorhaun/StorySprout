import { prisma } from "./db.server.js";
import { generateText, streamText, getProvider } from "./ai.server.js";
import {
  buildSystemPrompt,
  buildUserMessage,
  type PromptContext,
} from "./story-prompts.server.js";
import { validateBeatResponse } from "./validators.server.js";

// ─── Types ───────────────────────────────────────────────────

export interface StoryWithRelations {
  id: string;
  currentBeat: number;
  isComplete: boolean;
  style: { slug: string; name: string };
  theme: { name: string };
  beats: Array<{
    id: string;
    beatNumber: number;
    segment: string;
    chosenOption: string | null;
  }>;
}

// ─── Prompt Context Builder ──────────────────────────────────

export function buildPromptCtx(
  story: StoryWithRelations,
  chosenOption: string | null
): { promptCtx: PromptContext; nextBeatNumber: number } {
  const nextBeatNumber = story.beats.length + 1;

  const promptCtx: PromptContext = {
    styleSlug: story.style.slug,
    themeName: story.theme.name,
    beatNumber: nextBeatNumber,
    previousBeats: story.beats.map((b) => ({
      beatNumber: b.beatNumber,
      segment: b.segment,
      chosenOption:
        b.beatNumber === story.beats.length ? chosenOption : b.chosenOption,
    })),
  };

  return { promptCtx, nextBeatNumber };
}

// ─── Streaming Entry Point ───────────────────────────────────

/**
 * Creates a ReadableStream that:
 * 1. Streams text chunks as SSE events (for live UI updates)
 * 2. On completion: validates, saves to DB, sends "complete" event
 * 3. On validation failure: retries non-streaming, sends result
 * 4. On error: sends "error" event
 *
 * Call updatePreviousBeat() before this to persist the child's choice.
 */
export function createBeatStream(
  story: StoryWithRelations,
  nextBeatNumber: number,
  systemPrompt: string,
  userMessage: string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      try {
        // Stream text chunks from AI.
        // The AI returns JSON like {"beat":1,"segment":"Once upon...","question":...}
        // We extract just the "segment" value to stream to the client,
        // so the user sees story text, not raw JSON.
        let fullResponse = "";
        let segmentStarted = false;
        let sentLength = 0;

        for await (const chunk of streamText({ systemPrompt, userMessage })) {
          fullResponse += chunk;

          if (!segmentStarted) {
            // Look for "segment": " (or "segment":" with no space) in accumulated text
            const marker = fullResponse.match(/"segment"\s*:\s*"/);
            if (marker && marker.index !== undefined) {
              segmentStarted = true;
              // Extract any segment text that's already accumulated past the marker
              const segmentStart = marker.index + marker[0].length;
              const textSoFar = extractSegmentText(fullResponse, segmentStart);
              if (textSoFar.length > 0) {
                send(JSON.stringify(textSoFar));
                sentLength = textSoFar.length;
              }
            }
          } else {
            // We're inside the segment value — send new text
            const marker = fullResponse.match(/"segment"\s*:\s*"/);
            if (marker && marker.index !== undefined) {
              const segmentStart = marker.index + marker[0].length;
              const textSoFar = extractSegmentText(fullResponse, segmentStart);
              const newText = textSoFar.slice(sentLength);
              if (newText.length > 0) {
                send(JSON.stringify(newText));
                sentLength = textSoFar.length;
              }
            }
          }
        }

        // Validate the full response
        const validation = validateBeatResponse(fullResponse, nextBeatNumber);

        if (validation.success) {
          // Save and send complete event
          const beat = await saveBeat(
            story.id,
            nextBeatNumber,
            validation.data,
            getProvider(),
            fullResponse
          );
          send(JSON.stringify({ type: "complete", beat }));
        } else {
          // Validation failed — try non-streaming retry
          console.warn(
            `[story-engine] Stream validation failed: ${validation.error}. Retrying...`
          );
          const retryResult = await retryNonStreaming(
            story.id,
            nextBeatNumber,
            systemPrompt,
            userMessage
          );

          if (retryResult.success) {
            send(JSON.stringify({ type: "complete", beat: retryResult.beat }));
          } else {
            send(
              JSON.stringify({ type: "error", message: retryResult.error })
            );
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to generate beat";
        console.error("[story-engine] Stream error:", message);
        send(JSON.stringify({ type: "error", message }));
      } finally {
        send("[DONE]");
        controller.close();
      }
    },
  });
}

// ─── Segment Text Extractor ──────────────────────────────────

/**
 * Extracts the segment string value from the raw JSON being built.
 * Starts reading at `startIndex` (just past the opening quote of the segment value)
 * and reads until it finds an unescaped closing quote or end of string.
 * Handles JSON escape sequences like \" and \n.
 */
function extractSegmentText(raw: string, startIndex: number): string {
  let result = "";
  let i = startIndex;

  while (i < raw.length) {
    const ch = raw[i];

    if (ch === "\\") {
      // Escape sequence — look at next char
      const next = raw[i + 1];
      if (next === undefined) break; // incomplete escape, wait for more data
      if (next === '"') result += '"';
      else if (next === "n") result += "\n";
      else if (next === "t") result += "\t";
      else if (next === "\\") result += "\\";
      else if (next === "/") result += "/";
      else result += next; // fallback
      i += 2;
    } else if (ch === '"') {
      // Unescaped quote = end of segment value
      break;
    } else {
      result += ch;
      i++;
    }
  }

  return result;
}

// ─── Update Previous Beat Choice ─────────────────────────────

export async function updatePreviousBeat(
  story: StoryWithRelations,
  chosenOption: string | null
) {
  if (chosenOption && story.beats.length > 0) {
    const lastBeat = story.beats[story.beats.length - 1];
    await prisma.storyBeat.update({
      where: { id: lastBeat.id },
      data: { chosenOption },
    });
  }
}

// ─── Save Beat + Update Story Progress ───────────────────────

async function saveBeat(
  storyId: string,
  beatNumber: number,
  data: { segment: string; question: string | null; options: string[] },
  provider: string,
  rawJson: string
) {
  const newBeat = await prisma.storyBeat.create({
    data: {
      storyId,
      beatNumber,
      segment: data.segment,
      question: data.question,
      options: data.options,
      provider,
      rawJson,
    },
  });

  await prisma.story.update({
    where: { id: storyId },
    data: {
      currentBeat: beatNumber,
      isComplete: beatNumber === 5,
    },
  });

  return {
    id: newBeat.id,
    beatNumber: newBeat.beatNumber,
    segment: newBeat.segment,
    question: newBeat.question,
    options: newBeat.options,
    chosenOption: newBeat.chosenOption,
    provider: newBeat.provider,
    rawJson: newBeat.rawJson,
  };
}

// ─── Non-Streaming Retry ─────────────────────────────────────

async function retryNonStreaming(
  storyId: string,
  beatNumber: number,
  systemPrompt: string,
  userMessage: string
): Promise<
  | { success: true; beat: ReturnType<typeof saveBeat> extends Promise<infer T> ? T : never }
  | { success: false; error: string }
> {
  try {
    const result = await generateText({ systemPrompt, userMessage });
    const validation = validateBeatResponse(result.text, beatNumber);

    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const beat = await saveBeat(
      storyId,
      beatNumber,
      validation.data,
      result.provider,
      result.text
    );

    return { success: true, beat };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Retry failed",
    };
  }
}
