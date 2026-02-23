import { redirect } from "react-router";
import { logout } from "../lib/auth.server.js";
import type { Route } from "./+types/logout";

// Only POST — prevents logout via link clicks or crawlers
export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}

// If someone navigates to /logout directly, send them home
export async function loader() {
  return redirect("/");
}
