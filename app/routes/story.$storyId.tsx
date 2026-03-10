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
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [beatImages, setBeatImages] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const beat of story.beats) {
      if (beat.imageLeftUrl) {
        initial[beat.id] = beat.imageLeftUrl;
      }
    }
    return initial;
  });
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(() => {
    // Start on the latest beat, or 0 for "begin" screen
    return Math.max(0, story.beats.length - 1);
  });

  const isComplete = story.isComplete || beats.some((b) => b.beatNumber === 5);
  const currentBeat = beats[currentPage] ?? null;
  const needsFirstBeat = beats.length === 0;
  const isStreaming = isGeneratingText && streamingText.length > 0;

  // Should we show choice buttons for the current page?
  const showChoices =
    !isComplete &&
    !isGeneratingText &&
    currentBeat &&
    currentBeat.question &&
    !currentBeat.chosenOption &&
    currentPage === beats.length - 1;

  // Can navigate back/forward through already-viewed beats
  const canGoBack = currentPage > 0;
  const canGoForward = currentPage < beats.length - 1;

  // Auto-advance to new beat when it arrives
  useEffect(() => {
    if (beats.length > 0 && !isGeneratingText) {
      setCurrentPage(beats.length - 1);
    }
  }, [beats.length, isGeneratingText]);

  async function handleChoice(chosenOption: string | null) {
    setIsGeneratingText(true);
    setStreamingText("");
    setError(null);

    // Mark the previous beat's choice locally
    if (chosenOption && currentBeat) {
      setBeats((prev) =>
        prev.map((b) =>
          b.id === currentBeat.id ? { ...b, chosenOption } : b
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

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);

            if (typeof parsed === "string") {
              setStreamingText((prev) => prev + parsed);
            } else if (parsed.type === "complete") {
              setBeats((prev) => [...prev, parsed.beat]);
              setStreamingText("");
              setIsGeneratingText(false); // text is done — show the beat page
              setLoadingImages((prev) => new Set(prev).add(parsed.beat.id));
            } else if (parsed.type === "image") {
              setBeatImages((prev) => ({
                ...prev,
                [parsed.beatId]: parsed.imageUrl,
              }));
              setLoadingImages((prev) => {
                const next = new Set(prev);
                next.delete(parsed.beatId);
                return next;
              });
            } else if (parsed.type === "error") {
              throw new Error(parsed.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStreamingText("");
      setIsGeneratingText(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-cream">
      {/* Header — compact */}
      <header className="flex shrink-0 items-center justify-between px-4 py-2">
        <Link to="/" className="text-lg font-bold text-sprout">
          🌱 StorySprout
        </Link>
        <div className="text-xs text-gray-400">
          {story.style.emoji} {story.style.name} &middot; {story.theme.emoji}{" "}
          {story.theme.name}
        </div>
      </header>

      {/* Beat Progress Dots */}
      <div className="flex shrink-0 items-center justify-center gap-3 py-1">
        {BEAT_LABELS.map((label, i) => {
          const beatNum = i + 1;
          const isDone = beats.some((b) => b.beatNumber === beatNum);
          const isActive = currentBeat?.beatNumber === beatNum;

          return (
            <button
              key={beatNum}
              onClick={() => {
                const idx = beats.findIndex((b) => b.beatNumber === beatNum);
                if (idx >= 0) setCurrentPage(idx);
              }}
              disabled={!isDone}
              className="flex flex-col items-center gap-0.5"
            >
              <div
                className={`h-2.5 w-2.5 rounded-full transition ${
                  isActive
                    ? "scale-125 bg-sprout"
                    : isDone
                      ? "bg-sprout opacity-50"
                      : "bg-gray-300"
                }`}
              />
              <span className="text-[9px] text-gray-400">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content — fills remaining space */}
      <main className="relative flex min-h-0 flex-1 flex-col items-center px-4 pb-4">
        {/* "Begin the Story" screen */}
        {needsFirstBeat && !isGeneratingText && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <p className="mb-6 text-2xl font-bold text-gray-700">
              {story.theme.emoji} Ready for an adventure?
            </p>
            <button
              onClick={() => handleChoice(null)}
              className="rounded-2xl bg-sprout px-10 py-4 text-xl font-semibold text-white shadow-lg hover:bg-sprout-dark"
            >
              Begin the Story
            </button>
          </div>
        )}

        {/* Loading / Streaming — shown while generating */}
        {isGeneratingText && (
          <div className="flex flex-1 flex-col items-center justify-center">
            {isStreaming ? (
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-sm">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sprout-light">
                  {BEAT_LABELS[(beats.length) - 1] ?? ""}
                </p>
                <p className="whitespace-pre-wrap text-lg leading-relaxed text-gray-700">
                  {streamingText}
                  <span className="ml-0.5 inline-block animate-pulse text-sprout">|</span>
                </p>
              </div>
            ) : (
              <p className="animate-pulse text-xl text-gray-400">
                Turning the page...
              </p>
            )}
          </div>
        )}

        {/* Current Beat — the "page" */}
        {!isGeneratingText && currentBeat && (
          <div className="flex min-h-0 flex-1 flex-col items-center w-full max-w-2xl">
            {/* Image — takes up as much space as possible */}
            {(() => {
              const imageUrl = beatImages[currentBeat.id] ?? currentBeat.imageLeftUrl ?? null;
              const isWaiting = loadingImages.has(currentBeat.id);

              if (imageUrl) {
                return (
                  <div className="min-h-0 flex-1 w-full flex items-center justify-center py-2">
                    <img
                      src={imageUrl}
                      alt="Story illustration"
                      className="max-h-full max-w-full rounded-3xl object-contain shadow-md"
                    />
                  </div>
                );
              }
              if (isWaiting) {
                return (
                  <div className="min-h-0 flex-1 w-full flex items-center justify-center py-2">
                    <div className="flex aspect-square h-full max-h-[60vh] items-center justify-center rounded-3xl bg-purple-50 shadow-md">
                      <p className="animate-pulse text-lg text-sprout-light">
                        Painting the scene...
                      </p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Story Text — compact below image */}
            <div className="w-full shrink-0 py-2">
              <div className="rounded-2xl bg-white px-5 py-4 shadow-sm">
                <p className="whitespace-pre-wrap text-base leading-relaxed text-gray-700">
                  {currentBeat.segment}
                </p>
              </div>
            </div>

            {/* Choice Buttons or Navigation */}
            <div className="w-full shrink-0 pb-2">
              {showChoices && (
                <div className="space-y-2 text-center">
                  <p className="text-base font-medium text-gray-700">
                    {currentBeat.question}
                  </p>
                  <div className="flex justify-center gap-3">
                    {currentBeat.options.map((option, i) => (
                      <button
                        key={i}
                        onClick={() => handleChoice(option)}
                        className={`rounded-2xl px-6 py-3 text-base font-semibold text-white shadow-md transition ${
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

              {/* Story Complete */}
              {isComplete && currentPage === beats.length - 1 && (
                <div className="text-center">
                  <p className="text-3xl">🌟</p>
                  <h2 className="text-xl font-bold text-gray-800">The End</h2>
                  <p className="text-sm text-gray-500">Sweet dreams!</p>
                  <div className="mt-3 flex justify-center gap-3">
                    <Link
                      to="/story/new"
                      className="rounded-2xl bg-sprout px-6 py-2 text-base font-semibold text-white shadow-lg hover:bg-sprout-dark"
                    >
                      New Story
                    </Link>
                  </div>
                </div>
              )}

              {/* Past beat — show what was chosen */}
              {currentBeat.chosenOption && currentPage < beats.length - 1 && (
                <p className="text-center text-sm text-gray-400">
                  You chose: <span className="font-medium text-teal">{currentBeat.chosenOption}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !isGeneratingText && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <p className="text-red-500">{error}</p>
            <button
              onClick={() => handleChoice(null)}
              className="mt-2 rounded-xl bg-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-300"
            >
              Try again
            </button>
          </div>
        )}

        {/* Left / Right Navigation Arrows */}
        {beats.length > 0 && !isGeneratingText && (
          <>
            {canGoBack && (
              <button
                onClick={() => setCurrentPage((p) => p - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-2xl text-gray-400 shadow-md backdrop-blur-sm hover:bg-white hover:text-gray-600"
                aria-label="Previous page"
              >
                ‹
              </button>
            )}
            {canGoForward && (
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-2xl text-gray-400 shadow-md backdrop-blur-sm hover:bg-white hover:text-gray-600"
                aria-label="Next page"
              >
                ›
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
