# StorySprout TypeScript Reading Guide

A guided tour through the StorySprout codebase for re-learning TypeScript. Files are ordered from simplest to most complex, with key TS concepts called out for each.

---

## Level 1: Data & Types (start here)

### 1. `storySproutConfig.ts` (73 lines)

The gentlest starting point. Teaches:

- **`interface`** — defining the shape of objects (`StorySproutStyle`, `StorySproutTheme`)
- **`export`** — making things available to other files
- **Type annotations on arrays** — `StorySproutStyle[]` means "an array of StorySproutStyle objects"
- **`const` with explicit typing** — the compiler checks every object in the array matches the interface

> **Rust connection:** Think of `interface` like a Rust `struct` — it defines what fields an object must have and their types.

---

## Level 2: Database Layer

### 2. `app/lib/db.server.ts` (24 lines)

Small but teaches several important patterns:

- **`let` vs `const`** — `let prisma` because it gets assigned conditionally
- **`declare global`** — extending the global namespace (TypeScript-specific)
- **Type unions** — `PrismaClient | undefined`
- **Singleton pattern** — reusing a single DB client across hot reloads in dev

### 3. `prisma/seed.ts` (63 lines)

A standalone script that teaches:

- **`async/await`** — every `await prisma.style.upsert(...)` is an async DB call
- **`for...of` loops** — iterating over arrays
- **Promise chaining** — `.catch().finally()` at the end
- **Importing from your own modules** — pulling in `styles` and `themes` from the config

---

## Level 3: Auth & Sessions

### 4. `app/lib/auth.server.ts` (97 lines)

The meatiest "utility" file. Concepts:

- **Function signatures with types** — `async function login(email: string, password: string)`
- **Return type inference** — TypeScript figures out what these functions return
- **Nullable types** — `return null` when login fails (like Rust's `Option`)
- **Non-null assertion** — `process.env.SESSION_SECRET!` (the `!` tells TS "trust me, this exists")
- **Type narrowing** — `if (!userId || typeof userId !== "string")` narrows from `unknown` to `string`
- **`throw redirect()`** — throwing a Response (React Router pattern)

---

## Level 4: Validation

### 5. `app/lib/validators.server.ts` (215 lines)

The richest TypeScript learning file. Teaches:

- **Zod schemas** — `z.object()`, `z.string()`, `z.number().int().min(1).max(5)` — runtime type validation
- **`z.infer<typeof Schema>`** — deriving a TypeScript type FROM a Zod schema (very common pattern)
- **Union return types** — `ValidationResult | ValidationError` (like Rust's `Result<T, E>`)
- **Discriminated unions** — `success: true` vs `success: false` lets TS narrow the type
- **`RegExp`** — regex for word-boundary matching
- **Nullish coalescing** — `data.question ?? ""` (like Rust's `.unwrap_or("")`)
- **Pipeline pattern** — `validateBeatResponse()` chains parse → schema → structure → safety

---

## Level 5: AI Abstraction

### 6. `app/lib/ai.server.ts` (177 lines)

Introduces more advanced patterns:

- **Type aliases** — `type Provider = "anthropic" | "openai"` (string literal union)
- **`interface` for function options/results** — `GenerateOptions`, `GenerateResult`
- **`async function*` (async generators)** — `streamText()` uses `yield*` to delegate to provider-specific generators
- **`AsyncGenerator<string>`** — the return type of async generators
- **Optional chaining** — `chunk.choices[0]?.delta?.content`
- **`.filter()` + `.map()` + `.join()`** — functional array chaining

> **Rust connection:** Async generators are the closest JS equivalent to Rust iterators — they produce values lazily with `yield`.

---

## Level 6: The Engine (most complex)

### 7. `app/lib/story-prompts.server.ts` (159 lines)

- **`as const`** — `BEAT_LABELS` is a readonly tuple, not a mutable array
- **`Record<number, string>`** and **`Record<string, string>`** — typed dictionaries (like Rust's `HashMap<K, V>`)
- **Template literals** — backtick strings with `${variable}` interpolation
- **String building** — combining prompts from multiple sources

### 8. `app/lib/story-engine.server.ts` (289 lines)

The most complex file. Ties everything together:

- **`ReadableStream`** — Web Streams API for SSE
- **`TextEncoder`** — encoding strings to bytes
- **Generic type extraction** — `ReturnType<typeof saveBeat> extends Promise<infer T> ? T : never` (conditional types + `infer`)
- **Nested async logic** — streaming, accumulating, parsing JSON mid-stream
- **Error handling patterns** — try/catch with fallback retry

---

## Level 7: Routes (save for later)

After the server files, move on to the `.tsx` route files — these mix React JSX with TypeScript, so tackle them once you're comfortable with the pure TS files above.

Route files to read (in order):
1. `app/routes/logout.tsx` — simplest route (action only)
2. `app/routes/home.tsx` — basic loader + component
3. `app/routes/login.tsx` / `app/routes/signup.tsx` — forms + actions
4. `app/routes/story.new.tsx` — loader with DB queries + form
5. `app/routes/story.$storyId.tsx` — dynamic route params + complex state
6. `app/routes/api.story-beat.tsx` — resource route (API endpoint, no UI)

---

## Quick Reference: TS ↔ Rust Concepts

| TypeScript | Rust | Notes |
|---|---|---|
| `interface` | `struct` | Shape of an object |
| `type A \| B` | `enum` (sum type) | Union types |
| `T \| null` | `Option<T>` | Nullable |
| `{ success: true } \| { success: false, error }` | `Result<T, E>` | Discriminated union |
| `Record<K, V>` | `HashMap<K, V>` | Key-value map type |
| `as const` | N/A (Rust is immutable by default) | Makes values readonly |
| `async/await` | `async/await` | Nearly identical syntax |
| `async function*` / `yield` | `Iterator` trait / `next()` | Lazy value production |
| `?.` (optional chaining) | `.map()` on Option | Safe access through nulls |
| `??` (nullish coalescing) | `.unwrap_or()` | Default when null |
| `!` (non-null assertion) | `.unwrap()` | "Trust me, it's there" (unsafe-ish) |

---

## Top 3 Files to Read First

If you're short on time, start with these three:

1. **`storySproutConfig.ts`** — interfaces, exports, typed arrays
2. **`app/lib/validators.server.ts`** — Zod, discriminated unions, pipeline pattern
3. **`app/lib/ai.server.ts`** — async generators, type aliases, optional chaining
