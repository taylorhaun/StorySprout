import { Form, Link, useActionData, useNavigation } from "react-router";
import { signup, createUserSession, getUserId } from "../lib/auth.server.js";
import { prisma } from "../lib/db.server.js";
import type { Route } from "./+types/signup";

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

  const errors: { email?: string; password?: string } = {};

  if (!email || !email.includes("@")) {
    errors.email = "Please enter a valid email address.";
  }
  if (!password || password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { errors: { email: "An account with this email already exists." } };
  }

  const user = await signup(email, password);
  return createUserSession(user.id, "/");
}

export default function SignupPage() {
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
          <h1 className="mt-4 text-2xl font-bold text-gray-800">Create Account</h1>
          <p className="mt-2 text-gray-500">
            Sign up to create interactive bedtime stories.
          </p>
        </div>

        <Form method="post" className="space-y-6">
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
              autoComplete="new-password"
              required
              className="mt-1 block w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-800 placeholder-gray-400 focus:border-sprout focus:outline-none focus:ring-1 focus:ring-sprout"
              placeholder="At least 8 characters"
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
            {isSubmitting ? "Creating account..." : "Sign Up"}
          </button>
        </Form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="text-sprout hover:text-sprout-dark font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
