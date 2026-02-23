import { Form, Link, useLoaderData } from "react-router";
import { requireUser } from "../lib/auth.server.js";
import { prisma } from "../lib/db.server.js";
import type { Route } from "./+types/library";

export function meta() {
  return [{ title: "My Stories — StorySprout" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  const stories = await prisma.story.findMany({
    where: { userId: user.id },
    include: {
      style: true,
      theme: true,
      _count: { select: { beats: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return { stories, user };
}

export default function LibraryPage() {
  const { stories, user } = useLoaderData<typeof loader>();

  const inProgress = stories.filter((s) => !s.isComplete);
  const completed = stories.filter((s) => s.isComplete);

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="text-xl font-bold text-sprout">
          🌱 StorySprout
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/story/new"
            className="rounded-2xl bg-sprout px-5 py-2 text-sm font-semibold text-white hover:bg-sprout-dark"
          >
            New Story
          </Link>
          <Form method="post" action="/logout">
            <button
              type="submit"
              className="rounded-2xl px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Log out
            </button>
          </Form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-bold text-gray-800">My Stories</h1>
        <p className="mt-1 text-gray-500">
          {stories.length === 0
            ? "No stories yet — time to create your first!"
            : `${stories.length} ${stories.length === 1 ? "story" : "stories"} so far`}
        </p>

        {stories.length === 0 && (
          <div className="mt-10 text-center">
            <p className="text-6xl">📚</p>
            <p className="mt-4 text-lg text-gray-500">
              Your story library is empty.
            </p>
            <Link
              to="/story/new"
              className="mt-6 inline-block rounded-2xl bg-sprout px-8 py-3 text-lg font-semibold text-white shadow-lg hover:bg-sprout-dark"
            >
              Create Your First Story
            </Link>
          </div>
        )}

        {/* In Progress */}
        {inProgress.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-gray-700">
              In Progress ({inProgress.length})
            </h2>
            <div className="mt-3 space-y-3">
              {inProgress.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          </section>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-bold text-gray-700">
              Completed ({completed.length})
            </h2>
            <div className="mt-3 space-y-3">
              {completed.map((story) => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StoryCard({
  story,
}: {
  story: {
    id: string;
    isComplete: boolean;
    currentBeat: number;
    createdAt: string | Date;
    style: { name: string; emoji: string };
    theme: { name: string; emoji: string };
    _count: { beats: number };
  };
}) {
  const date = new Date(story.createdAt);
  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <Link
      to={`/story/${story.id}`}
      className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      {/* Style + Theme emojis */}
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cream text-xl">
        {story.theme.emoji}
      </div>

      {/* Info */}
      <div className="flex-1">
        <p className="font-semibold text-gray-800">
          {story.theme.name} — {story.style.name}
        </p>
        <p className="text-sm text-gray-400">
          {dateStr} · {story._count.beats} of 5 beats
        </p>
      </div>

      {/* Status badge */}
      {story.isComplete ? (
        <span className="rounded-full bg-sprout/10 px-3 py-1 text-xs font-semibold text-sprout">
          Read again
        </span>
      ) : (
        <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">
          Continue
        </span>
      )}
    </Link>
  );
}
