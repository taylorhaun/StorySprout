# Playlab Interview Study Guide

20 concepts, ordered by dependency. Each one builds on the last. Drill them in order.

---

## 1. React Component Model

**What to know:** A component is a function that takes props and returns JSX. Data flows one direction: parent → child via props. If a child needs to talk to a parent, the parent passes a callback function down.

**Key details:**
- Props are read-only — a child never mutates them
- JSX is syntactic sugar for `React.createElement()` calls
- Components re-render when their props change OR their internal state changes
- A re-render doesn't mean the DOM updates — React diffs the virtual DOM first (reconciliation)

```tsx
// Parent passes data DOWN via props
function StoryCard({ title, onSelect }: { title: string; onSelect: () => void }) {
  return <button onClick={onSelect}>{title}</button>;
}

// Parent owns the data and the callback
function StoryList() {
  const stories = ["Penguin Adventure", "Space Journey"];
  return stories.map((title) => (
    <StoryCard
      key={title}
      title={title}
      onSelect={() => console.log(`Selected: ${title}`)} // child calls UP via callback
    />
  ));
}
```

**Why this matters:** React's entire model is built on this. If you can't explain one-way data flow clearly, everything else falls apart. In an interview, they might ask "how does a child component communicate with its parent?" — the answer is always callbacks passed as props.

**Explain it:** "If I pass `<Child name="Taylor" />` and later pass `<Child name="Wyman" />`, what happens internally? Does the Child component unmount and remount?"

---

## 2. useState

**What to know:** `useState` gives a component its own mutable data. Calling the setter triggers a re-render. State updates are asynchronous and batched — React doesn't immediately update the value when you call the setter.

**Key details:**
- `const [count, setCount] = useState(0)` — destructured tuple, initial value only used on first render
- State is preserved between re-renders because React tracks hooks by call order (this is why you can't call hooks conditionally)
- Never call hooks inside `if`, loops, or nested functions — this breaks the call order and React loses track of which state belongs where

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  function handleClick() {
    // BUG: both read the same stale `count` value (e.g., 0)
    // Result: count goes from 0 → 1, not 0 → 2
    setCount(count + 1);
    setCount(count + 1);
  }

  function handleClickCorrect() {
    // CORRECT: each updater receives the latest pending value
    // First call: prev=0 → returns 1
    // Second call: prev=1 → returns 2
    setCount((prev) => prev + 1);
    setCount((prev) => prev + 1);
  }

  return <button onClick={handleClickCorrect}>{count}</button>;
}
```

**Why the function form matters:** When you write `setCount(count + 1)`, `count` is a snapshot from that render — it's a plain number captured in the closure, not a live reference. If you call the setter twice, both calls read the same snapshot. The function form `setCount(prev => prev + 1)` receives the most recent pending value, so updates chain correctly.

**Explain it:** "You have a form with 5 fields. Should each field be its own `useState`, or should you use one state object? What are the tradeoffs?" (Hint: individual states are simpler and don't cause unnecessary re-renders of unrelated fields, but a single object is easier if fields are related or you need to reset them all at once.)

---

## 3. useEffect

**What to know:** `useEffect` is for synchronizing your component with something external — a browser API, a subscription, a timer, a third-party library. It runs *after* the component renders and paints to the screen.

**The mental model that matters:** Don't think of useEffect as "run code when something changes." Think of it as "keep this external thing in sync with my component's state."

**Key details:**
- `useEffect(() => { ... }, [deps])` — runs after render when any value in `deps` changes
- Empty array `[]` = run once after first render (sync with "nothing changing")
- No array = run after every render (almost never what you want)
- Return a cleanup function — React calls it before the next effect run AND on unmount
- React StrictMode double-invokes effects in dev to catch missing cleanups — if your effect breaks when run twice, you have a bug

```tsx
// PATTERN: Syncing with an external system (document title)
function StoryPage({ storyTitle }: { storyTitle: string }) {
  useEffect(() => {
    document.title = `StorySprout — ${storyTitle}`;
    // No cleanup needed — next run just overwrites
  }, [storyTitle]); // Only re-run when storyTitle changes
}

// PATTERN: Cleanup to prevent memory leaks
function ChatRoom({ roomId }: { roomId: string }) {
  useEffect(() => {
    const connection = createConnection(roomId);
    connection.connect();

    return () => {
      // Cleanup: disconnect when roomId changes or component unmounts
      connection.disconnect();
    };
  }, [roomId]);
}

// ANTI-PATTERN: Fetching data in useEffect (use loaders instead in Remix)
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Problems: no loading state, no error handling, race condition if
    // userId changes before fetch completes, waterfall (component must
    // render before fetch starts)
    let cancelled = false;
    fetch(`/api/users/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setUser(data); // Stale closure guard
      });
    return () => { cancelled = true; };
  }, [userId]);
}
```

**Why Remix loaders make this better:** The anti-pattern above is exactly what loaders solve. The loader runs *before* the component renders, on the server, with no race conditions, no loading state management, and no waterfalls. In Remix, you almost never need `useEffect` for data fetching.

**Explain it:** "You have a useEffect that starts a setInterval. After 5 renders, how many intervals are running? What happens if you forget the cleanup?"

---

## 4. Rendering Cycle & Reconciliation

**What to know:** When state changes, React does three things in order: (1) Trigger — something caused a state update, (2) Render — React calls your component function to get new JSX, (3) Commit — React compares old and new JSX and updates only the DOM nodes that changed.

**Key details:**
- "Rendering" = calling your component function. It does NOT mean touching the DOM.
- Parent re-render causes all children to re-render by default (React doesn't know if a child's output changed without calling it)
- React compares elements by type and position. Same type + same position = update the existing DOM node. Different type = destroy and recreate.
- `key` is how React tracks identity in lists. Without stable keys, React can't tell which item moved, was added, or was removed.

```tsx
// WHY KEYS MATTER
function StoryBeatList({ beats }: { beats: Beat[] }) {
  return (
    <ul>
      {beats.map((beat) => (
        // GOOD: stable ID as key — React tracks each beat correctly
        <li key={beat.id}>{beat.segment}</li>

        // BAD: index as key — if you insert a beat at the top,
        // React thinks every item changed (index 0 is now different content)
        // <li key={index}>{beat.segment}</li>
      ))}
    </ul>
  );
}

// BATCHING: React combines these into ONE re-render
function handleSubmit() {
  setName("Taylor");      // queued
  setAge(30);             // queued
  setSubmitting(true);    // queued
  // React processes all three, then re-renders once
}
```

**The DOM diff in action:** Say you have a list of 100 story beats and update beat #47's text. React calls your component, gets new JSX for all 100 `<li>` elements, compares each one, and finds that only #47's text content changed. It updates that single text node in the DOM. The other 99 `<li>` elements are untouched.

**Explain it:** "You have `{isAdmin ? <AdminPanel /> : <UserPanel />}`. When `isAdmin` flips from true to false, does React update AdminPanel or destroy it? Why?"

---

## 5. useRef

**What to know:** `useRef` returns an object `{ current: value }` that persists across renders. Changing `.current` does NOT trigger a re-render. Two main uses: grabbing DOM elements and storing mutable values that shouldn't cause re-renders.

```tsx
// USE CASE 1: DOM access
function SearchBar() {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleButtonClick() {
    inputRef.current?.focus(); // Directly focus the input
  }

  return (
    <>
      <input ref={inputRef} placeholder="Search stories..." />
      <button onClick={handleButtonClick}>Focus</button>
    </>
  );
}

// USE CASE 2: Storing a value without triggering re-renders
function StoryPlayer() {
  const [beat, setBeat] = useState(1);
  const prevBeatRef = useRef(1);

  useEffect(() => {
    console.log(`Moved from beat ${prevBeatRef.current} to beat ${beat}`);
    prevBeatRef.current = beat; // Update ref — no re-render triggered
  }, [beat]);
}

// USE CASE 3: Timer IDs (classic example)
function AutoSave() {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  function scheduleAutoSave() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveDocument(), 3000);
  }
  // timerRef.current changes often, but we never need to re-render for it
}
```

**When to use ref vs state:** If changing the value should update what the user sees → `useState`. If it's bookkeeping the component needs internally but the user never sees → `useRef`. Timer IDs, previous values, DOM nodes, and third-party library instances are all ref territory.

**Explain it:** "You're building a stopwatch. Where do you store the interval ID — state or ref? What about the elapsed time that displays on screen?"

---

## 6. Custom Hooks

**What to know:** A custom hook is a function that starts with `use` and calls other hooks inside it. It lets you extract and reuse stateful logic. Each component that uses the hook gets its own independent copy of that state.

```tsx
// Custom hook: tracks window width
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}

// Two components using the same hook — they do NOT share state
function Sidebar() {
  const width = useWindowWidth(); // Has its own width state
  return width > 768 ? <nav>...</nav> : null;
}

function Header() {
  const width = useWindowWidth(); // Separate width state, same logic
  return <span>Width: {width}</span>;
}
```

```tsx
// More practical example: form field hook
function useFormField(initialValue: string) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    setError(null); // Clear error on change
  }

  function validate(validator: (v: string) => string | null) {
    const err = validator(value);
    setError(err);
    return !err;
  }

  return { value, error, handleChange, validate };
}

// Usage
function SignupForm() {
  const email = useFormField("");
  const password = useFormField("");

  function handleSubmit() {
    const emailValid = email.validate((v) => v.includes("@") ? null : "Invalid email");
    const passValid = password.validate((v) => v.length >= 8 ? null : "Too short");
    if (emailValid && passValid) { /* submit */ }
  }
}
```

**The key insight:** Custom hooks aren't about sharing state between components — they're about sharing *logic*. `useWindowWidth` doesn't give both components the same width variable. It gives each component its own width variable that's kept in sync with the window using the same resize listener logic.

**Explain it:** "When should you extract a custom hook vs just writing the logic inline? What's the test for 'this should be a hook'?"

---

## 7. Loader → Component Data Flow (Remix)

**What to know:** In Remix/React Router, the `loader` function runs on the server before the component renders. It fetches data and returns it. The component reads it with `useLoaderData()`. This completely replaces the `useEffect` + `useState` fetch pattern.

```tsx
// app/routes/story.$storyId.tsx

import { useLoaderData } from "react-router";
import type { Route } from "./+types/story.$storyId";
import { db } from "~/lib/db.server";

// RUNS ON THE SERVER — has access to DB, env vars, file system
// The URL param $storyId is available in params
export async function loader({ params }: Route.LoaderArgs) {
  const story = await db.story.findUnique({
    where: { id: params.storyId },
    include: {
      beats: { orderBy: { beat: "asc" } },
      style: true,
      theme: true,
    },
  });

  if (!story) {
    throw new Response("Story not found", { status: 404 });
  }

  return { story };
}

// RUNS ON THE CLIENT (and server for SSR)
// useLoaderData() gives you exactly what the loader returned, fully typed
export default function StoryPage() {
  const { story } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>{story.style.name}: {story.theme.name}</h1>
      {story.beats.map((beat) => (
        <p key={beat.id}>{beat.segment}</p>
      ))}
    </div>
  );
}
```

**What this replaces (the old way):**
```tsx
// DON'T DO THIS IN REMIX — this is the traditional React pattern
function StoryPage({ storyId }: { storyId: string }) {
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/stories/${storyId}`)
      .then((res) => res.json())
      .then(setStory)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [storyId]);

  if (loading) return <Spinner />;
  if (error) return <Error />;
  return <div>{story.title}</div>;
}
// Problems: loading waterfall (render → fetch → render), no SSR, race conditions,
// 3 state variables to manage one piece of data
```

**Why loaders are better:**
1. **No waterfalls** — data is ready before the component renders, the user never sees an empty shell
2. **Server-only code** — DB queries, API keys, and secrets never touch the client bundle
3. **Automatic revalidation** — after an action (form submit), Remix re-calls loaders automatically
4. **Simpler component** — no loading/error state management, just render the data

**Connect to what you know:** This is like Next.js `getServerSideProps` (pages router) or server components (app router). The difference: in Remix, the loader is a named export on the route file alongside the component. In Next.js 13+, the server component *is* the loader.

**Explain it:** "The loader runs on every navigation to the route, not just the first time. Why is that important? What would break if it only ran once?"

---

## 8. Actions & `<Form>` (Remix)

**What to know:** Mutations (creating, updating, deleting data) in Remix work through HTML form semantics. A route exports an `action` function that handles POST requests. Remix's `<Form>` component submits the form via fetch instead of a full page reload, but the mental model is the same as a traditional HTML form.

```tsx
// app/routes/story.new.tsx
import { Form, useActionData, redirect } from "react-router";
import type { Route } from "./+types/story.new";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/auth.server";

// LOADER: fetch data needed to render the form
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request); // Redirect to login if not authed
  const styles = await db.style.findMany();
  const themes = await db.theme.findMany();
  return { styles, themes };
}

// ACTION: handle form submission (POST)
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const styleId = formData.get("styleId");
  const themeId = formData.get("themeId");

  // Validate
  if (!styleId || !themeId) {
    return { error: "Please select a style and theme" }; // Returned to component
  }

  // Create the story
  const story = await db.story.create({
    data: {
      userId: user.id,
      styleId: styleId.toString(),
      themeId: themeId.toString(),
      currentBeat: 1,
      isComplete: false,
    },
  });

  // Redirect to the story page — this triggers the story route's loader
  return redirect(`/story/${story.id}`);
}

export default function NewStory() {
  const { styles, themes } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>(); // Gets { error } if validation failed

  return (
    <Form method="post">
      {actionData?.error && <p className="text-red-500">{actionData.error}</p>}

      <select name="styleId">
        {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <select name="themeId">
        {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>

      <button type="submit">Start Story</button>
    </Form>
  );
}
```

**The revalidation cycle — this is the magic:**
1. User clicks "Start Story" → `<Form>` serializes inputs and POSTs to the route
2. `action` runs on the server → creates the story → returns `redirect`
3. Remix follows the redirect → calls the new route's `loader`
4. New page renders with fresh data

If the action returns data instead of redirecting (like a validation error), Remix re-calls all active loaders to ensure the page has fresh data. You never manually refetch.

**Progressive enhancement:** If JavaScript fails to load, `<Form>` falls back to a native HTML form submission. The action still runs, the redirect still works. The user gets a full page reload instead of a client-side navigation, but it works.

**Explain it:** "After an action completes successfully, Remix re-calls all active loaders. Why? What could go wrong if it didn't?"

---

## 9. Nested Routes & `<Outlet>`

**What to know:** Routes in Remix can be nested inside each other. A parent route wraps child routes using `<Outlet>`. Each route level can have its own loader, action, and error boundary. Parent loaders and child loaders run in parallel.

```
URL: /story/abc123

Route tree:
  root.tsx          → <html>, <head>, <body>, nav
    └── story.tsx   → story layout (header, back button)
        └── story.$storyId.tsx → actual story content
```

```tsx
// app/routes/story.tsx — PARENT layout route
import { Outlet } from "react-router";

export default function StoryLayout() {
  return (
    <div className="max-w-2xl mx-auto p-8">
      <header className="mb-6">
        <a href="/">← Back to Home</a>
        <h1>StorySprout</h1>
      </header>

      {/* Child route renders here */}
      <Outlet />
    </div>
  );
}
```

```tsx
// app/routes/story.$storyId.tsx — CHILD route (renders inside Outlet)
export async function loader({ params }: Route.LoaderArgs) {
  // params.storyId comes from the $storyId in the filename
  return { story: await db.story.findUnique({ where: { id: params.storyId } }) };
}

export default function StoryDetail() {
  const { story } = useLoaderData<typeof loader>();
  return <div>{story.title}</div>;
}
```

**What makes this powerful:**
- When you navigate from `/story/abc` to `/story/def`, only the child route re-renders. The parent layout (header, nav, back button) stays mounted — no flicker, no re-fetch.
- Parent and child loaders run **in parallel**, not sequentially. Remix calls both at the same time and waits for both.
- Each level can have its own `ErrorBoundary`. If the child throws, the parent still renders and shows the child's error boundary inside the `<Outlet>`.

**The file naming convention:**
- `story.tsx` = parent layout for `/story/*`
- `story.new.tsx` = child at `/story/new`
- `story.$storyId.tsx` = child at `/story/:storyId` (dynamic segment)
- The dot (`.`) in the filename creates nesting

**Connect to what you know:** Next.js `layout.tsx` does this implicitly — any `layout.tsx` in a folder wraps all routes in that folder. Remix is more explicit: you export `<Outlet>` where you want the child to render, giving you more control over placement.

**Explain it:** "You navigate from `/story/abc` to `/story/def`. Which loaders re-run? Which components re-render? Which stay mounted?"

---

## 10. useNavigation & Pending UI

**What to know:** `useNavigation()` tells you the current state of any in-progress navigation or form submission. Use it for loading spinners, disabled buttons, and optimistic UI.

```tsx
import { Form, useNavigation } from "react-router";

export default function NewStory() {
  const navigation = useNavigation();

  // navigation.state is one of: "idle" | "submitting" | "loading"
  // "submitting" = action is running
  // "loading" = action finished, loaders are revalidating
  const isSubmitting = navigation.state !== "idle";

  return (
    <Form method="post">
      <select name="styleId">...</select>
      <select name="themeId">...</select>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating story..." : "Start Story"}
      </button>
    </Form>
  );
}
```

```tsx
// OPTIMISTIC UI: Show the choice immediately, before the server responds
function BeatChoice({ options }: { options: string[] }) {
  const navigation = useNavigation();

  // If we're submitting, we can read what the user picked
  const pendingChoice = navigation.formData?.get("choice") as string | undefined;

  return (
    <Form method="post">
      {options.map((option) => (
        <button
          key={option}
          name="choice"
          value={option}
          disabled={!!pendingChoice}
          className={pendingChoice === option ? "opacity-50" : ""}
        >
          {option}
          {pendingChoice === option && " ✓"}
        </button>
      ))}
    </Form>
  );
}
```

**The three states in sequence:**
1. `"idle"` → user is browsing, nothing in progress
2. `"submitting"` → form was submitted, action is running on the server
3. `"loading"` → action completed, Remix is re-calling loaders to get fresh data
4. Back to `"idle"` → new data is loaded, page is updated

**Explain it:** "What's the difference between `navigation.state === 'submitting'` and `navigation.state === 'loading'`? When would you show different UI for each?"

---

## 11. Resource Routes

**What to know:** A resource route is a route file that exports a `loader` and/or `action` but does NOT export a default component. It's a pure API endpoint — returns JSON, files, redirects, or any other Response.

```tsx
// app/routes/api.story-beat.tsx — RESOURCE ROUTE (no default export)

import type { Route } from "./+types/api.story-beat";
import { db } from "~/lib/db.server";
import { requireUser } from "~/lib/auth.server";
import { generateBeat } from "~/lib/story-engine.server";

// This is an API endpoint — no UI, just JSON
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const storyId = formData.get("storyId") as string;
  const choice = formData.get("choice") as string | null;

  const beat = await generateBeat(storyId, choice);

  return Response.json({ beat });
}
```

```tsx
// Calling it from a component with useFetcher
import { useFetcher } from "react-router";

function StoryPlayer({ storyId }: { storyId: string }) {
  const fetcher = useFetcher();

  function handleChoice(choice: string) {
    // POST to the resource route without navigating
    fetcher.submit(
      { storyId, choice },
      { method: "post", action: "/api/story-beat" }
    );
  }

  return (
    <div>
      {fetcher.state === "submitting" && <p>Generating next beat...</p>}
      {fetcher.data && <p>{fetcher.data.beat.segment}</p>}
      <button onClick={() => handleChoice("Go left")}>Go left</button>
      <button onClick={() => handleChoice("Go right")}>Go right</button>
    </div>
  );
}
```

**When to use resource routes vs regular actions:**
- Regular route action: the mutation is tied to the current page (create story, update profile)
- Resource route: the mutation is called from multiple places, or you don't want a navigation (API-style, background operations)

**`useFetcher` vs `<Form>`:** `<Form>` causes a navigation (URL changes, loaders re-run). `useFetcher` calls the endpoint without navigating — the user stays on the same page. Use `useFetcher` when you want to call an API endpoint in the background.

**Explain it:** "Your StorySprout app has `api.story-beat.tsx` as a resource route. Why didn't you put the beat generation logic in the `story.$storyId.tsx` action instead?"

---

## 12. Error Boundaries

**What to know:** Each route can export an `ErrorBoundary` component. If anything throws in that route's loader, action, or component, the error boundary renders instead — without crashing the whole app.

```tsx
// app/routes/story.$storyId.tsx
import { useRouteError, isRouteErrorResponse } from "react-router";

export async function loader({ params }: Route.LoaderArgs) {
  const story = await db.story.findUnique({ where: { id: params.storyId } });

  if (!story) {
    // Throw a Response for expected errors (not found, unauthorized, etc.)
    throw new Response("Story not found", { status: 404 });
  }

  return { story };
}

export default function StoryPage() {
  const { story } = useLoaderData<typeof loader>();
  return <div>{story.title}</div>;
}

// Catches errors from this route's loader, action, or component
export function ErrorBoundary() {
  const error = useRouteError();

  // Check if it's a Response we threw intentionally
  if (isRouteErrorResponse(error)) {
    return (
      <div>
        <h1>{error.status === 404 ? "Story not found" : "Something went wrong"}</h1>
        <p>{error.data}</p>
      </div>
    );
  }

  // Unexpected error (bug in code, network failure, etc.)
  return (
    <div>
      <h1>Oops!</h1>
      <p>Something unexpected happened. Please try again.</p>
    </div>
  );
}
```

**Error bubbling:** If `story.$storyId.tsx` doesn't have an ErrorBoundary, the error bubbles up to `story.tsx`, then to `root.tsx`. The closest ancestor with an ErrorBoundary catches it. This means the rest of the app (nav, layout) stays functional — only the broken section shows the error.

**Thrown Responses vs thrown Errors:**
- `throw new Response("Not found", { status: 404 })` — expected, handled gracefully, `isRouteErrorResponse()` returns true
- `throw new Error("DB connection failed")` — unexpected, bug or infrastructure issue, generic error UI

**Explain it:** "Your app has a root layout, a story layout, and a story detail page. The story detail loader throws a 404. What does the user see? What if you remove the error boundary from the story detail — what happens then?"

---

## 13. TypeScript — Generics

**What to know:** Generics let you write functions and types that work with any type while keeping type safety. Think of `<T>` as a "type variable" — it gets filled in when the function is called.

```typescript
// WITHOUT generics — you lose type information
function firstElement(arr: any[]): any {
  return arr[0];
}
const x = firstElement([1, 2, 3]); // x is `any` — TypeScript forgot it's a number

// WITH generics — type flows through
function firstElement<T>(arr: T[]): T {
  return arr[0];
}
const x = firstElement([1, 2, 3]);       // x is `number` — inferred from the argument
const y = firstElement(["a", "b"]);      // y is `string`

// CONSTRAINED generics — T must have certain properties
function getById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find((item) => item.id === id);
}

// Works with any type that has an `id: string`
const story = getById(stories, "abc");  // story is Story | undefined
const user = getById(users, "xyz");     // user is User | undefined
// getById([1, 2, 3], "1"); // ERROR: number doesn't have .id

// You already use generics constantly:
useState<number>(0);              // Generic: State<number>
Promise<User>;                     // Generic: Promise<User>
Array<string>;                     // Generic: Array<string>
Record<string, StoryBeat>;        // Generic: Record<K, V>
```

**Explain it:** "Write a generic function `groupBy` that takes an array of objects and a key name, and returns them grouped into a Record. What constraints does the generic need?"

---

## 14. TypeScript — Discriminated Unions

**What to know:** A union type where each variant has a literal "tag" field (discriminant). When you check the tag, TypeScript automatically narrows the type and knows which fields exist.

```typescript
// THE PATTERN: each variant has a `status` literal that distinguishes it
type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: string };

function renderState(state: AsyncState<User>) {
  switch (state.status) {
    case "idle":
      return null;
    case "loading":
      return <Spinner />;
    case "success":
      // TypeScript KNOWS state.data exists here — it narrowed the type
      return <UserCard user={state.data} />;
    case "error":
      // TypeScript KNOWS state.error exists here
      return <ErrorMessage message={state.error} />;
  }
}

// WHY THIS IS BETTER than the boolean flags approach:
type BadState = {
  data: User | null;
  error: string | null;
  loading: boolean;
};
// Problem: nothing stops you from having { data: someUser, error: "failed", loading: true }
// That's an impossible state, but the type system allows it.
// Discriminated unions make impossible states unrepresentable.
```

```typescript
// EXHAUSTIVE CHECKING with `never`
function handleStatus(state: AsyncState<User>) {
  switch (state.status) {
    case "idle": return "idle";
    case "loading": return "loading";
    case "success": return state.data.name;
    // If you forget "error", TypeScript complains:
    default:
      const _exhaustive: never = state; // ERROR: Type 'error' is not assignable to 'never'
      return _exhaustive;
  }
}
// This means: if you add a new variant later, the compiler tells you
// everywhere you forgot to handle it.
```

**Where you'll see this:**
- API response types (success vs error)
- Form state (idle, submitting, submitted, error)
- Route loader data (different shapes based on auth status)
- WebSocket message types (different payloads per event)

**Explain it:** "Model a WebSocket message type for a collaborative editor. Messages could be: user joined, user left, text changed, cursor moved. Each has different data. How do you type it so handlers are type-safe?"

---

## 15. TypeScript — Utility Types

**What to know:** Built-in types that transform other types. These save you from redefining modified versions of your types.

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

// Partial<T> — all fields become optional
type UserUpdate = Partial<User>;
// { id?: string; name?: string; email?: string; ... }
// Use case: PATCH endpoint that accepts any subset of fields

// Pick<T, Keys> — select specific fields
type UserPublic = Pick<User, "id" | "name" | "email">;
// { id: string; name: string; email: string }
// Use case: what you return from the API (exclude passwordHash)

// Omit<T, Keys> — everything except specified fields
type UserWithoutPassword = Omit<User, "passwordHash">;
// { id: string; name: string; email: string; createdAt: Date }
// Use case: same idea, approached from the other direction

// Record<Keys, Value> — object with specific keys and value types
type StoryBeatMap = Record<number, StoryBeat>;
// { [key: number]: StoryBeat }
// Use case: indexing beats by beat number

// ReturnType<T> — extract what a function returns
async function getStory(id: string) {
  return db.story.findUnique({ where: { id }, include: { beats: true } });
}
type StoryWithBeats = Awaited<ReturnType<typeof getStory>>;
// The full type of what getStory returns, including the included beats
// Awaited unwraps the Promise
```

```typescript
// COMBINING utility types (real-world pattern)
type CreateUserInput = Pick<User, "name" | "email"> & { password: string };
// Must provide name + email + password, nothing else
// Used in your signup action

type UpdateUserInput = Partial<Pick<User, "name" | "email">>;
// Can optionally update name and/or email
// Used in a profile update action
```

**Explain it:** "Your action gets `formData` and needs to build a Prisma `update` call. The user might have changed their name, email, or both. How do you type this so you only pass changed fields to Prisma?"

---

## 16. Prisma — Schema & Relations

**What to know:** The Prisma schema (`schema.prisma`) defines your database structure declaratively. Models map to tables, fields map to columns, and relations are explicit with foreign keys.

```prisma
// From StorySprout's schema (simplified)
model User {
  id           String   @id @default(uuid())
  email        String?  @unique          // nullable for future OAuth-only users
  passwordHash String?                   // nullable for same reason
  stories      Story[]                   // One user has many stories
  createdAt    DateTime @default(now())
}

model Style {
  id      String  @id @default(uuid())
  name    String  @unique               // "Whimsical Rhyme", "Calm Bedtime", etc.
  stories Story[]                       // One style used in many stories
}

model Story {
  id          String      @id @default(uuid())
  userId      String                    // FK → User
  user        User        @relation(fields: [userId], references: [id])
  styleId     String                    // FK → Style
  style       Style       @relation(fields: [styleId], references: [id])
  themeId     String                    // FK → Theme
  theme       Theme       @relation(fields: [themeId], references: [id])
  currentBeat Int         @default(1)
  isComplete  Boolean     @default(false)
  beats       StoryBeat[]               // One story has many beats
  createdAt   DateTime    @default(now())
  // NOTE: No unique constraint on styleId+themeId — kids can replay same combo
}

model StoryBeat {
  id           String   @id @default(uuid())
  storyId      String                   // FK → Story
  story        Story    @relation(fields: [storyId], references: [id])
  beat         Int                      // 1-5
  segment      String                   // The story text
  question     String?                  // null for beat 5 (no choice)
  options      String[]                 // empty for beat 5
  chosenOption String?                  // what the user picked
  rawJson      String?                  // debug: raw AI response
  createdAt    DateTime @default(now())
}
```

**Reading a relation:** Every relation has two sides. `Story` has `userId String` (the actual FK column in the database) and `user User @relation(...)` (the Prisma relation field for queries). The `@relation` annotation says: "this model's `userId` field references the `id` field on User."

**The `include` vs `select` distinction:**
```typescript
// include: fetch the story AND all its related data (joins)
const story = await db.story.findUnique({
  where: { id: storyId },
  include: { beats: true, style: true, theme: true },
});
// story.beats is StoryBeat[], story.style is Style, story.theme is Theme

// select: fetch only specific fields (more efficient)
const story = await db.story.findUnique({
  where: { id: storyId },
  select: { id: true, currentBeat: true, style: { select: { name: true } } },
});
// story is { id: string, currentBeat: number, style: { name: string } }
// No beats loaded, no theme loaded — only what you asked for
```

**Explain it:** "Walk through the StorySprout schema. What happens at the database level when you delete a User who has Stories? What should happen?" (Hint: cascading deletes, and Prisma requires you to be explicit about this.)

---

## 17. Prisma — Queries in Loaders & Actions

**What to know:** Prisma queries live in your server-side code (`loader` and `action` functions, or `.server.ts` files). Common patterns for CRUD.

```typescript
// READ: Get a user's stories with related data
export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  const stories = await db.story.findMany({
    where: { userId: user.id },
    include: { style: true, theme: true },
    orderBy: { createdAt: "desc" },
  });

  return { stories };
}

// CREATE: Start a new story
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();

  const story = await db.story.create({
    data: {
      userId: user.id,
      styleId: formData.get("styleId") as string,
      themeId: formData.get("themeId") as string,
    },
  });

  return redirect(`/story/${story.id}`);
}

// TRANSACTION: Create a beat AND update the story atomically
async function saveBeatAndAdvance(storyId: string, beatData: BeatData) {
  // Either both operations succeed or neither does
  const [beat, story] = await db.$transaction([
    db.storyBeat.create({
      data: {
        storyId,
        beat: beatData.beat,
        segment: beatData.segment,
        question: beatData.question,
        options: beatData.options,
        rawJson: JSON.stringify(beatData),
      },
    }),
    db.story.update({
      where: { id: storyId },
      data: {
        currentBeat: beatData.beat,
        isComplete: beatData.beat === 5,
      },
    }),
  ]);

  return { beat, story };
}
```

**Why transactions matter here:** If `storyBeat.create` succeeds but `story.update` fails (DB crash, constraint violation, etc.), you'd have a beat saved but the story's `currentBeat` still pointing to the old value. The story and beat would be out of sync. `$transaction` ensures atomic: both succeed or both roll back.

**N+1 query awareness:**
```typescript
// BAD: N+1 — fetches stories, then one query per story to get beats
const stories = await db.story.findMany({ where: { userId } });
for (const story of stories) {
  story.beats = await db.storyBeat.findMany({ where: { storyId: story.id } });
}
// If user has 20 stories → 1 + 20 = 21 queries

// GOOD: One query with include
const stories = await db.story.findMany({
  where: { userId },
  include: { beats: true },
});
// 1 query total (Prisma does a JOIN or a second batched query)
```

**Explain it:** "You're building a 'My Stories' page that shows each story with its style name and how many beats have been completed. Write the Prisma query. How many database queries does it execute?"

---

## 18. Docker Basics

**What to know:** Docker packages your application and all its dependencies into a container — a lightweight, isolated environment that runs the same everywhere. Docker Compose orchestrates multiple containers (like your app + database) together.

```dockerfile
# Dockerfile — multi-stage build
# STAGE 1: Build (has Node, npm, dev dependencies — large image)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                     # Install ALL dependencies (including devDeps)
COPY . .
RUN npx prisma generate        # Generate Prisma client
RUN npm run build              # Build the app

# STAGE 2: Production (only runtime — small image)
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml — orchestrate app + database
services:
  postgres:
    image: postgres:16
    ports:
      - "5434:5432"          # Host port 5434 → container port 5432
    environment:              # Why 5434? Avoids conflict if Postgres
      POSTGRES_DB: storysprout  # is already running locally on 5432
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data  # Persist data across restarts

  app:
    build: .                 # Build from Dockerfile in current directory
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5434/storysprout
    depends_on:
      - postgres             # Start postgres before app

volumes:
  pgdata:                    # Named volume — survives container recreation
```

**Key concepts:**
- **Image vs container:** Image is the blueprint (read-only). Container is a running instance of an image.
- **Multi-stage builds:** Build stage has everything (compilers, dev deps). Production stage copies only what's needed. Result: much smaller final image.
- **Volumes:** Without a volume, database data is destroyed when the container stops. Volumes persist data on the host filesystem.
- **Port mapping `"5434:5432"`:** Traffic hitting your machine on port 5434 gets forwarded to port 5432 inside the container.

**Explain it:** "You delete your Docker containers and recreate them. Is your database data gone? What if you also delete the volumes?"

---

## 19. WebSockets (Conceptual)

**What to know:** HTTP is request-response: client asks, server answers, connection closes. WebSockets are persistent, bidirectional: client and server keep a connection open and either side can send messages at any time. This is essential for real-time features.

```
HTTP:
  Client → "Give me data" → Server
  Client ← response ← Server
  (connection closed)

WebSocket:
  Client → "Open connection" → Server
  Client ← "Connected" ← Server
  (connection stays open)
  Client → "I typed 'hello'" → Server
  Server → "User B typed 'world'" → Client
  Server → "User C joined" → Client
  (messages flow freely in both directions until one side closes)
```

**Why Playlab needs this:** Their AI tools for educators likely involve real-time collaboration — multiple teachers editing a lesson plan, live AI suggestions appearing as you type, seeing other users' cursors. You can't do this with HTTP because the server can't push to the client without being asked.

**Alternatives and why they're worse:**
- **Polling (HTTP):** Client asks "any updates?" every 2 seconds. Wasteful — most requests return nothing. Adds latency (up to 2 seconds stale). Doesn't scale well.
- **Server-Sent Events (SSE):** Server can push to client (one-way). Good for live feeds, but client can't send messages back through the same connection.
- **WebSockets:** True bidirectional. Both sides send whenever they want. Low latency. Best for collaborative editing, chat, multiplayer, live dashboards.

**In a Remix app:**
WebSocket connections don't go through Remix's loader/action cycle. You typically run a WebSocket server alongside your Remix server (or use a service like Pusher/Ably). The Remix app handles page loads and form submissions; the WebSocket handles real-time updates.

```typescript
// Simplified example — not Remix-specific
// Server
const wss = new WebSocketServer({ port: 8080 });
wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    // Broadcast to all other connected clients
    wss.clients.forEach((client) => {
      if (client !== ws) client.send(data);
    });
  });
});

// Client (in a React component)
useEffect(() => {
  const ws = new WebSocket("ws://localhost:8080");
  ws.onmessage = (event) => {
    const update = JSON.parse(event.data);
    // Apply the update to local state
  };
  return () => ws.close(); // Cleanup on unmount
}, []);
```

**Explain it:** "Playlab wants to add a feature where two teachers can co-edit an AI prompt template in real-time. Sketch the architecture: what handles the page load, what handles the real-time sync, and how do they connect?"

---

## 20. Putting It All Together — System Design Walkthrough

**What to know:** Be able to trace a user interaction through every layer of the stack: UI → route → loader/action → database/AI → response → UI update. This is what interviewers are testing when they ask you to "walk through" a feature.

**Walkthrough #1 — StorySprout: User makes a story choice**

```
1. User sees beat 3 with two choices: "Climb the tree" and "Swim the river"
2. User clicks "Climb the tree"
3. <Form method="post"> serializes: { storyId: "abc", choice: "Climb the tree", beat: 4 }
4. useNavigation().state → "submitting" → button shows "Generating..."
5. Route action runs on server:
   a. requireUser(request) — verify auth cookie
   b. Parse formData — get storyId, choice, next beat number
   c. Save the choice: update beat 3's chosenOption to "Climb the tree"
   d. Call AI: build prompt with story context + choice + beat 4 instructions
   e. Parse AI JSON response: { beat: 4, segment: "...", question: "...", options: [...] }
   f. Transaction: create beat 4 record + update story.currentBeat to 4
   g. Return { beat: newBeat }
6. Remix revalidates: calls the route's loader again
7. Loader fetches story with all beats from DB, returns fresh data
8. useNavigation().state → "idle"
9. Component re-renders with new beat visible
10. User sees beat 4 with new text and two new choices
```

**Walkthrough #2 — StudyFlow: Researcher creates a study**

```
1. Researcher fills out study creation form (title, description, school, dates)
2. Clicks "Create Study"
3. <Form method="post"> submits to the route's action
4. Action: validate with Zod → create Study record → create default StudyPhases →
   redirect to /studies/[newId]
5. New route's loader: fetch study with phases, team members, school
6. Component renders the study dashboard
```

**Walkthrough #3 — Hypothetical Playlab feature: Real-time AI lesson builder**

```
1. Teacher navigates to /lessons/new → loader checks auth, returns templates
2. Teacher starts typing a lesson prompt
3. WebSocket connection opened on mount (useEffect + cleanup)
4. On keystroke (debounced): send current text to server via WebSocket
5. Server receives text → calls AI API for suggestions → streams back via WebSocket
6. Client receives AI suggestions → updates local state → renders inline
7. Teacher clicks "Save" → <Form method="post"> → action saves to DB
8. Another teacher opens the same lesson → WebSocket room → sees live edits
```

**How to structure a walkthrough in the interview:**
1. Start with the user action ("The user clicks...")
2. Explain the client-side mechanics (Form, navigation state)
3. Walk through the server (action, validation, DB, external APIs)
4. Explain what comes back (redirect, data, error)
5. End with what the user sees

---

## Drill Schedule

| Session | Topics | Time |
|---------|--------|------|
| 1 | #1-3 (React core: components, state, effects) | 60-90 min |
| 2 | #4-6 (Rendering, refs, custom hooks) | 60-90 min |
| 3 | #7-9 (Remix: loaders, actions, nested routes) | 60-90 min |
| 4 | #10-12 (Remix: navigation, resource routes, errors) | 60-90 min |
| 5 | #13-15 (TypeScript: generics, unions, utilities) | 60-90 min |
| 6 | #16-17 (Prisma: schema, queries) | 45-60 min |
| 7 | #18-19 (Docker, WebSockets) | 45-60 min |
| 8 | #20 (Full walkthroughs, mock interview) | 60-90 min |

## How to Drill Each Topic

1. **Read the section** — make sure the concept clicks
2. **Try to answer the "Explain it" question** out loud, without looking
3. **Ask Claude to quiz you** — say "quiz me on #7" and I'll push back like an interviewer
4. **Build something small** if it's still fuzzy — that's what StorySprout is for
5. **Move on** when you can explain it clearly to someone who doesn't know it
