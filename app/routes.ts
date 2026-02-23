import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("signup", "routes/signup.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("library", "routes/library.tsx"),
  route("story/new", "routes/story.new.tsx"),
  route("story/:storyId", "routes/story.$storyId.tsx"),
  route("api/story-beat", "routes/api.story-beat.tsx"),
] satisfies RouteConfig;
