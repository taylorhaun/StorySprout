# TypeScript Learning Guide — StorySprout

Taylor's study guide for learning TypeScript concepts through the StorySprout codebase.
Organized by priority. Each concept links to the exact file(s) where it appears.

---

## Tier 1: Core Concepts (used heavily in StorySprout)

### 1. Interfaces & Type Aliases
Defining the shape of objects. Like Rust structs.
- `app/lib/story-prompts.server.ts` — `PromptContext` interface
- `app/lib/ai.server.ts` — `GenerateOptions`, `GenerateResult` interfaces
- `app/lib/validators.server.ts` — `ValidationResult`, `ValidationError`
- `storySproutConfig.ts` — `StorySproutStyle`, `StorySproutTheme`

### 2. Union Types
A value that can be one of several types. Like Rust enums (simpler version).
- `app/lib/ai.server.ts` — `type Provider = "anthropic" | "openai"`
- `app/lib/validators.server.ts` — `string | null` for optional fields
- `app/routes/story.$storyId.tsx` — `useState<string | null>(null)`

### 3. Discriminated Unions
Union types with a shared field that tells you which variant you have. Closest thing to Rust's `enum { Variant1 { ... }, Variant2 { ... } }`.
- `app/lib/validators.server.ts` — `{ success: true, data }` vs `{ success: false, error }`
- `app/lib/story-engine.server.ts` — `retryNonStreaming` return type
- `app/routes/story.$storyId.tsx` — SSE events: `{ type: "complete" }` vs `{ type: "error" }`

### 4. Type Narrowing
Proving to the compiler which type you have inside a branch. Like Rust pattern matching.
- `app/lib/story-engine.server.ts` — `if (validation.success)` narrows the discriminated union
- `app/routes/story.$storyId.tsx` — `if (e instanceof Error)`, `typeof parsed === "string"`
- `app/lib/auth.server.ts` — `if (!user || !user.passwordHash) return null`

### 5. Zod Schemas & z.infer
Define validation schema once, derive the TypeScript type from it. One source of truth.
- `app/lib/validators.server.ts` — `BeatResponseSchema` + `type BeatResponse = z.infer<typeof BeatResponseSchema>`

### 6. Async/Await & Promise.all
Sequential and parallel async operations.
- `app/routes/story.new.tsx` — `Promise.all([prisma.style.findMany(), prisma.theme.findMany()])`
- `app/lib/story-engine.server.ts` — sequential awaits for DB operations

### 7. Async Generators
`async function*` that yields values over time. Used for streaming.
- `app/lib/ai.server.ts` — `streamText()`, `streamAnthropic()`, `streamOpenAI()`
- `app/lib/story-engine.server.ts` — `for await (const chunk of streamText(...))`

### 8. Optional Chaining & Nullish Coalescing
Safe property access + default values. Like Rust's `.and_then()` + `.unwrap_or()`.
- `app/lib/ai.server.ts` — `response.choices[0]?.message?.content ?? ""`
- `app/routes/story.$storyId.tsx` — `latestBeat?.beatNumber`, `lines.pop() ?? ""`

### 9. React Hooks with Generics
Telling React what type a hook's value will be.
- `app/routes/story.$storyId.tsx` — `useState<string | null>(null)`, `useRef<HTMLDivElement>(null)`

### 10. Record<K, V>
Built-in type for key-value lookup tables. Like Rust's `HashMap<K, V>`.
- `app/lib/story-prompts.server.ts` — `Record<number, string>` for `BEAT_GUIDANCE`, `Record<string, string>` for `STYLE_INSTRUCTIONS`

---

## Tier 2: Good to Know (for PlayLab interviews)

### 11. Generics
Parameterized types. Same concept as Rust's `<T>`. TypeScript uses `extends` instead of trait bounds.
- `app/routes/story.$storyId.tsx` — React hooks use generics: `useState<T>`, `useRef<T>`
- `app/lib/validators.server.ts` — `z.infer<typeof BeatResponseSchema>` is a generic
- Not heavily custom-written in StorySprout, but important to understand

### 12. Utility Types
Built-in type transformers.
- `Partial<T>` — all fields optional
- `Pick<T, K>` — select specific fields
- `Omit<T, K>` — exclude specific fields
- `Required<T>` — all fields required
- Not explicitly used in StorySprout yet, but common in real codebases

### 13. as const
Makes values readonly literal types instead of widened types.
- `app/lib/story-prompts.server.ts` — `BEAT_LABELS = [...] as const`

### 14. Global Type Augmentation
Extending global types (niche but shows up in singletons).
- `app/lib/db.server.ts` — `declare global { var __db__: PrismaClient | undefined; }`

---

## Tier 3: Framework-Specific (learn by using)

### 15. React Router Type Integration
Auto-generated types for loaders/actions.
- All route files — `type Route from "./+types/[route]"`, `Route.LoaderArgs`, `Route.ActionArgs`

### 16. Prisma Type Integration
Prisma generates types from your schema. Relation includes produce typed nested objects.
- `app/lib/story-engine.server.ts` — `include: { beats: {...}, style: true, theme: true }`

### 17. Error Boundaries
Type-safe error handling in React Router.
- `app/root.tsx` — `isRouteErrorResponse(error)` type guard

---

## Quiz Bank

### Concept Identification
For each code snippet, identify which TypeScript concept is being used.

### Code Reading
Given a file, trace the types through a function and explain what TypeScript knows at each point.

### Modification Challenges
Small tasks like: "Add a new field to PromptContext — what else needs to change?"

### Spot the Error
Intentionally broken code — find the type error before the compiler does.

---

## Study Order (recommended)

1. Read through interfaces & type aliases in storySproutConfig.ts (simplest file)
2. Follow a type through the system: PromptContext defined -> used in buildSystemPrompt -> used in story-engine
3. Study discriminated unions in validators.server.ts (the validation pipeline)
4. Trace the streaming flow: ai.server.ts generators -> story-engine consumption -> SSE to client
5. Practice generics on Mimo, then come back and identify every generic usage in StorySprout
6. Learn utility types, then look for places in StorySprout where they could be useful
