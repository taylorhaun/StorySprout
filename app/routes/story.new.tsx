import { Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { redirect } from "react-router";
import { requireUser } from "../lib/auth.server.js";
import { prisma } from "../lib/db.server.js";
import type { Route } from "./+types/story.new";

export function meta() {
  return [{ title: "New Story — StorySprout" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireUser(request);

  const [styles, themes] = await Promise.all([
    prisma.style.findMany({ orderBy: { name: "asc" } }),
    prisma.theme.findMany({ orderBy: { name: "asc" } }),
  ]);

  return { styles, themes };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const styleId = String(formData.get("styleId"));
  const themeId = String(formData.get("themeId"));

  const errors: { style?: string; theme?: string } = {};

  if (!styleId) errors.style = "Please pick a style.";
  if (!themeId) errors.theme = "Please pick a theme.";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  // Verify style and theme exist
  const [style, theme] = await Promise.all([
    prisma.style.findUnique({ where: { id: styleId } }),
    prisma.theme.findUnique({ where: { id: themeId } }),
  ]);

  if (!style) return { errors: { style: "Invalid style." } };
  if (!theme) return { errors: { theme: "Invalid theme." } };

  const story = await prisma.story.create({
    data: {
      userId: user.id,
      styleId: style.id,
      themeId: theme.id,
    },
  });

  return redirect(`/story/${story.id}`);
}

export default function NewStoryPage() {
  const { styles, themes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="text-xl font-bold text-sprout">
          🌱 StorySprout
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-center text-3xl font-bold text-gray-800">
          Create Your Story
        </h1>
        <p className="mt-2 text-center text-gray-500">
          Pick a style and a theme, then let the magic begin!
        </p>

        <Form method="post" className="mt-10 space-y-10">
          {/* Style Selection */}
          <div>
            <h2 className="text-xl font-bold text-gray-800">Choose a Style</h2>
            {actionData?.errors?.style && (
              <p className="mt-1 text-sm text-red-500">{actionData.errors.style}</p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {styles.map((style) => (
                <label
                  key={style.id}
                  className="group cursor-pointer rounded-2xl border-2 border-gray-200 bg-white p-5 text-center shadow-sm transition hover:border-sprout-light has-[:checked]:border-sprout has-[:checked]:shadow-md"
                >
                  <input
                    type="radio"
                    name="styleId"
                    value={style.id}
                    className="sr-only"
                    required
                  />
                  <p className="text-4xl">{style.emoji}</p>
                  <h3 className="mt-3 text-lg font-bold text-gray-800">{style.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{style.description}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Theme Selection */}
          <div>
            <h2 className="text-xl font-bold text-gray-800">Choose a Theme</h2>
            {actionData?.errors?.theme && (
              <p className="mt-1 text-sm text-red-500">{actionData.errors.theme}</p>
            )}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {themes.map((theme) => (
                <label
                  key={theme.id}
                  className="group cursor-pointer rounded-2xl border-2 border-gray-200 bg-white p-5 text-center shadow-sm transition hover:border-teal-light has-[:checked]:border-teal has-[:checked]:shadow-md"
                >
                  <input
                    type="radio"
                    name="themeId"
                    value={theme.id}
                    className="sr-only"
                    required
                  />
                  <p className="text-4xl">{theme.emoji}</p>
                  <h3 className="mt-3 text-lg font-bold text-gray-800">{theme.name}</h3>
                  <p className="mt-1 text-sm text-gray-500">{theme.description}</p>
                </label>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="text-center">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-sprout px-10 py-3 text-lg font-semibold text-white shadow-lg hover:bg-sprout-dark disabled:opacity-50"
            >
              {isSubmitting ? "Starting..." : "Start Story"}
            </button>
          </div>
        </Form>
      </main>
    </div>
  );
}
