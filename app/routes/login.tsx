import { Form, Link, useActionData, useNavigation } from "react-router";
import { login, createUserSession, getUserId } from "../lib/auth.server.js";
import type { Route } from "./+types/login";

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await getUserId(request);
  if (userId) {
    throw new Response(null, {
      status: 302,
      headers: { Location: "/" },
    });
  }
  return {};
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email")).trim();
  const password = String(formData.get("password"));

  const errors: { email?: string; password?: string; form?: string } = {};

  if (!email || !email.includes("@")) {
    errors.email = "Please enter a valid email address.";
  }
  if (!password) {
    errors.password = "Please enter your password.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const user = await login(email, password);
  if (!user) {
    return { errors: { form: "Invalid email or password." } };
  }

  return createUserSession(user.id, "/");
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link to="/" className="text-3xl font-bold text-sprout">
            🌱 StorySprout
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-gray-800">Welcome Back</h1>
          <p className="mt-2 text-gray-500">
            Log in to continue your stories.
          </p>
        </div>

        <Form method="post" className="space-y-6">
          {actionData?.errors?.form && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
              {actionData.errors.form}
            </p>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-800 placeholder-gray-400 focus:border-sprout focus:outline-none focus:ring-1 focus:ring-sprout"
              placeholder="you@example.com"
            />
            {actionData?.errors?.email && (
              <p className="mt-1 text-sm text-red-500">{actionData.errors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-800 placeholder-gray-400 focus:border-sprout focus:outline-none focus:ring-1 focus:ring-sprout"
              placeholder="Your password"
            />
            {actionData?.errors?.password && (
              <p className="mt-1 text-sm text-red-500">{actionData.errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-sprout px-4 py-2 font-semibold text-white hover:bg-sprout-dark focus:outline-none focus:ring-2 focus:ring-sprout focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? "Logging in..." : "Log In"}
          </button>
        </Form>

        <p className="text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <Link to="/signup" className="text-sprout hover:text-sprout-dark font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
