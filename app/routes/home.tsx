import { Form, Link, useLoaderData } from "react-router";
import { getUserId } from "../lib/auth.server.js";
import type { Route } from "./+types/home";

export function meta() {
  return [
    { title: "StorySprout — Interactive Bedtime Stories" },
    {
      name: "description",
      content: "Create magical, interactive bedtime stories for your little one.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  return { isLoggedIn: !!userId };
}

export default function HomePage() {
  const { isLoggedIn } = useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-bold text-sprout">StorySprout</h1>
        <div>
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <Link
                to="/library"
                className="rounded-2xl px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800"
              >
                My Stories
              </Link>
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
          ) : (
            <div className="flex gap-3">
              <Link
                to="/login"
                className="rounded-2xl px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="rounded-2xl bg-sprout px-5 py-2 text-sm font-semibold text-white hover:bg-sprout-dark"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-6xl">🌱</p>
        <h2 className="mt-4 text-4xl font-bold tracking-tight text-gray-800 sm:text-5xl">
          Bedtime stories that grow with your child
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-500">
          Pick a style, choose a theme, and watch a magical story unfold.
          Your little one makes choices along the way!
        </p>

        <div className="mt-10 flex justify-center gap-4">
          <Link
            to={isLoggedIn ? "/story/new" : "/signup"}
            className="rounded-2xl bg-sprout px-8 py-3 text-lg font-semibold text-white shadow-lg hover:bg-sprout-dark"
          >
            Create a Story
          </Link>
        </div>

        {/* Style preview */}
        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-4xl">✨</p>
            <h3 className="mt-3 text-lg font-bold text-gray-800">Whimsical Rhyme</h3>
            <p className="mt-1 text-sm text-gray-500">Bouncy, playful, full of rhythm</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-4xl">🌙</p>
            <h3 className="mt-3 text-lg font-bold text-gray-800">Calm Bedtime</h3>
            <p className="mt-1 text-sm text-gray-500">Soft, gentle, cozy and warm</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-4xl">🤪</p>
            <h3 className="mt-3 text-lg font-bold text-gray-800">Silly & Goofy</h3>
            <p className="mt-1 text-sm text-gray-500">Laugh-out-loud absurdity</p>
          </div>
        </div>
      </main>
    </div>
  );
}
