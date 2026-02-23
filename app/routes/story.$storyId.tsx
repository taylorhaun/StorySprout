import { Link, useLoaderData } from "react-router";
import { useState, useRef, useEffect } from "react";
import { requireUser } from "../lib/auth.server.js";
import { prisma } from "../lib/db.server.js";
import type { Route } from "./+types/story.$storyId";

const BEAT_LABELS = [
  "Meet the Friend",
  "Something Happens",
  "Try a Thing",
  "Big Hooray",
  "Cozy Ending",
];

export function meta() {
  return [{ title: "Your Story — StorySprout" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const { storyId } = params;

  const story = await prisma.story.findUnique({
    where: { id: storyId },
    include: {
      style: true,
      theme: true,
      beats: { orderBy: { beatNumber: "asc" } },
    },
  });

  if (!story || story.userId !== user.id) {
    throw new Response("Story not found", { status: 404 });
  }

  return { story };
}

export default function StoryPage() {
  const { story } = useLoaderData<typeof loader>();
  const [beats, setBeats] = useState(story.beats);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const streamEndRef = useRef<HTMLDivElement>(null);

  const isComplete = story.isComplete || beats.some((b) => b.beatNumber === 5);
  const latestBeat = beats[beats.length - 1];
  const needsFirstBeat = beats.length === 0;
  const isStreaming = isLoading && streamingText.length > 0;

  // The beat number currently being generated
  const nextBeatNumber = beats.length + 1;

  // Should we show choice buttons?
  const showChoices =
    !isComplete &&
    !isLoading &&
    latestBeat &&
    latestBeat.question &&
    !latestBeat.chosenOption;

  // Auto-scroll to bottom as streaming text arrives
  useEffect(() => {
    if (isStreaming) {
      streamEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [streamingText, isStreaming]);

  async function handleChoice(chosenOption: string | null) {
    setIsLoading(true);
    setStreamingText("");
    setError(null);

    // Mark the previous beat's choice locally
    if (chosenOption && latestBeat) {
      setBeats((prev) =>
        prev.map((b) =>
          b.id === latestBeat.id ? { ...b, chosenOption } : b
        )
      );
    }

    try {
      const res = await fetch("/api/story-beat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: story.id,
          chosenOption,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Something went wrong");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines
        const lines = buffer.split("\n");
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);

            if (typeof parsed === "string") {
              // Raw text chunk — append to streaming display
              setStreamingText((prev) => prev + parsed);
            } else if (parsed.type === "complete") {
              // Final beat with all metadata — add to beats array
              setBeats((prev) => [...prev, parsed.beat]);
              setStreamingText("");
            } else if (parsed.type === "error") {
              throw new Error(parsed.message);
            }
          } catch (e) {
            // If JSON.parse fails on a chunk, it's a malformed SSE line — skip
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStreamingText("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="text-xl font-bold text-sprout">
          🌱 StorySprout
        </Link>
        <div className="text-sm text-gray-500">
          {story.style.emoji} {story.style.name} &middot; {story.theme.emoji}{" "}
          {story.theme.name}
        </div>
      </header>

      {/* Beat Progress */}
      <div className="mx-auto flex max-w-md items-center justify-center gap-2 px-6 py-4">
        {BEAT_LABELS.map((label, i) => {
          const beatNum = i + 1;
          const isDone = beats.some((b) => b.beatNumber === beatNum);
          const isCurrent =
            !isDone && (beats.length === 0 ? beatNum === 1 : beatNum === (latestBeat?.beatNumber ?? 0) + 1);

          return (
            <div key={beatNum} className="flex flex-col items-center gap-1">
              <div
                className={`h-3 w-3 rounded-full transition ${
                  isDone
                    ? "bg-sprout"
                    : isCurrent
                      ? "animate-pulse bg-sprout-light"
                      : "bg-gray-300"
                }`}
              />
              <span className="text-[10px] text-gray-400">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Story Content */}
      <main className="mx-auto max-w-2xl px-6 py-6">
        {/* Completed Beats */}
        {beats.map((beat) => (
          <div key={beat.id} className="mb-8">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sprout-light">
              {BEAT_LABELS[beat.beatNumber - 1]}
            </p>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-gray-700">
                {beat.segment}
              </p>
            </div>
            {beat.chosenOption && (
              <p className="mt-2 text-center text-sm text-gray-400">
                You chose: <span className="font-medium text-teal">{beat.chosenOption}</span>
              </p>
            )}
          </div>
        ))}

        {/* Streaming Text (live AI generation) */}
        {isStreaming && (
          <div className="mb-8">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sprout-light">
              {BEAT_LABELS[nextBeatNumber - 1]}
            </p>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="whitespace-pre-wrap text-lg leading-relaxed text-gray-700">
                {streamingText}
                <span className="ml-0.5 inline-block animate-pulse text-sprout">|</span>
              </p>
            </div>
          </div>
        )}

        {/* First beat trigger */}
        {needsFirstBeat && !isLoading && (
          <div className="text-center">
            <button
              onClick={() => handleChoice(null)}
              className="rounded-2xl bg-sprout px-10 py-3 text-lg font-semibold text-white shadow-lg hover:bg-sprout-dark"
            >
              Begin the Story
            </button>
          </div>
        )}

        {/* Choice Buttons */}
        {showChoices && latestBeat && (
          <div className="mt-4 space-y-3 text-center">
            <p className="text-lg font-medium text-gray-700">{latestBeat.question}</p>
            <div className="flex justify-center gap-4">
              {latestBeat.options.map((option, i) => (
                <button
                  key={i}
                  onClick={() => handleChoice(option)}
                  className={`rounded-2xl px-8 py-3 text-lg font-semibold text-white shadow-md transition ${
                    i === 0
                      ? "bg-sprout hover:bg-sprout-dark"
                      : "bg-teal hover:bg-teal-dark"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading (before streaming starts) */}
        {isLoading && !isStreaming && (
          <div className="mt-8 text-center">
            <p className="animate-pulse text-lg text-gray-400">
              Turning the page...
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 text-center">
            <p className="text-red-500">{error}</p>
            <button
              onClick={() => handleChoice(null)}
              className="mt-2 rounded-xl bg-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-300"
            >
              Try again
            </button>
          </div>
        )}

        {/* Story Complete */}
        {isComplete && (
          <div className="mt-8 text-center">
            <p className="text-4xl">🌟</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-800">The End</h2>
            <p className="mt-1 text-gray-500">Sweet dreams!</p>
            <div className="mt-6 flex justify-center gap-4">
              <Link
                to="/library"
                className="inline-block rounded-2xl bg-white px-8 py-3 text-lg font-semibold text-gray-600 shadow-lg hover:bg-gray-50"
              >
                My Stories
              </Link>
              <Link
                to="/story/new"
                className="inline-block rounded-2xl bg-sprout px-8 py-3 text-lg font-semibold text-white shadow-lg hover:bg-sprout-dark"
              >
                New Story
              </Link>
            </div>
          </div>
        )}

        <div ref={streamEndRef} />
      </main>
    </div>
  );
}
