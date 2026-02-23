# StorySprout — Claude Code Instructions

## Project Overview

StorySprout is an interactive AI bedtime story app for ages 3-5. Users pick a **style** and **theme**, then play through a structured 5-beat story arc with simple choose-your-own-adventure choices at each step.

This project was bootstrapped from [ChattyKathys](../ChattyKathys/) and shares the same tech stack.

## Tech Stack

- **Framework:** React Router v7 (formerly Remix) — loaders, actions, nested routes
- **Language:** TypeScript (strict mode) — full stack
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** Custom session cookies + bcrypt; Google + GitHub OAuth planned via `remix-auth`
- **AI:** Anthropic Claude SDK + OpenAI SDK (dual provider, selected via `AI_PROVIDER` env var)
- **Styling:** Tailwind CSS v4
- **Containerization:** Docker + Docker Compose (local dev)
- **Deployment:** AWS (ECS + Fargate + RDS) — planned

## Story Structure (5-Beat Arc)

| Beat | Label | Purpose |
|------|-------|---------|
| 1 | Meet the Friend | Introduce character & setting |
| 2 | Something Happens | Fun event (not scary) |
| 3 | Try a Thing | Character explores or attempts |
| 4 | Big Hooray | Happy success or reveal |
| 5 | Cozy Ending | Calm wrap-up, no choice offered |

- Beats 1-4 include a question with exactly 2 choice options
- Beat 5 auto-ends with no choice
- Each beat is 80-120 words max
- Each beat returns strict JSON: `{ beat, segment, question, options }`

## Styles (Seeded)

- **Whimsical Rhyme** — bouncy rhyming couplets, repetition, nonsense words
- **Calm Bedtime** — slow pacing, gentle sensory language, reassuring
- **Silly & Goofy** — funny sounds, absurd situations, playful exaggeration

## Themes (Seeded)

Penguins, Jungle, Space, Friendship, Farm, Ocean

## Key Architecture Decisions

### Bootstrapped from ChattyKathys
Same framework, same patterns. Files like `db.server.ts` and `auth.server.ts` are direct copies.

### `.server.ts` Convention
Files named `*.server.ts` are excluded from the client bundle:
- `app/lib/db.server.ts` — Prisma client singleton
- `app/lib/auth.server.ts` — session cookies, password hashing, `requireUser()`
- `app/lib/ai.server.ts` — AI provider abstraction (to be implemented)
- `app/lib/story-engine.server.ts` — beat progression + prompt building (to be implemented)
- `app/lib/story-prompts.server.ts` — system prompt templates per style/beat (to be implemented)
- `app/lib/validators.server.ts` — Zod schemas + content safety (to be implemented)

### Non-Streaming Beat Generation
Unlike ChattyKathys (SSE streaming), StorySprout uses standard request/response. Each beat is a single AI API call that returns complete JSON. Reasoning: can't show partial JSON meaningfully, 2-4s latency is fine for the use case.

### No Unique Constraint on Stories
Kids can replay the same style+theme combination multiple times. Each story is a discrete play-through.

### Vite SSR Env Var Gotcha
Same as ChattyKathys: Vite zeroes out non-`VITE_`-prefixed env vars in SSR. Use `dotenv` with `override: true` in `.server.ts` files.

## Project Structure

```
app/
├── routes/
│   ├── home.tsx              # Landing page
│   ├── login.tsx             # Email/password login
│   ├── signup.tsx            # Email/password signup
│   ├── logout.tsx            # Logout action (POST only)
│   ├── story.new.tsx         # Story creation — pick style + theme
│   ├── story.$storyId.tsx    # Story playback — beats + choices
│   └── api.story-beat.tsx    # API: generate next beat (resource route)
├── components/               # (to be added as needed)
├── lib/
│   ├── db.server.ts          # Prisma client singleton
│   └── auth.server.ts        # Session, cookies, bcrypt
└── app.css                   # Tailwind v4 import + theme
```

## Database

Five tables: `users`, `styles`, `themes`, `stories`, `story_beats`.

- Styles and themes are seeded (not user-created). Seed data lives in `storySproutConfig.ts`.
- Stories track `currentBeat` (1-5) and `isComplete`.
- StoryBeats store `segment`, `question`, `options` (text[]), `chosenOption`, and `rawJson` for debugging.
- All IDs are UUIDs.
- User model supports nullable email/passwordHash for future OAuth-only users.

### Running Migrations
```bash
npx prisma migrate dev          # development
npx prisma migrate deploy       # production
npx prisma db seed              # seed styles + themes
npx prisma studio               # GUI for browsing data
```

## Local Development

```bash
# Start Postgres in Docker (port 5434)
docker compose up -d postgres

# Install dependencies
npm install

# Set up database
npx prisma generate
npx prisma migrate dev
npx prisma db seed

# Start dev server
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` — Postgres connection string (default: `localhost:5434/storysprout`)
- `SESSION_SECRET` — random hex string for signing cookies
- `ANTHROPIC_API_KEY` — Claude API key
- `OPENAI_API_KEY` — OpenAI API key
- `AI_PROVIDER` — `"anthropic"` (default) or `"openai"`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — for Google OAuth (optional until implemented)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — for GitHub OAuth (optional until implemented)

## Content Safety

This app is for children aged 3-5. All AI-generated content must be:
- Age-appropriate — simple vocabulary, short sentences
- Positive — no violence, danger, sadness, fear, villains, darkness
- Safe — both choice options lead to equally happy outcomes
- Bounded — max 120 words per beat segment

Safety is enforced at the prompt level (primary) and via keyword blocklist validation (backup).

## Teaching Approach

This is Taylor's learning project. Do NOT just write everything silently. Instead:
- Explain what we're doing and why at each step
- Check Taylor's understanding regularly
- When introducing new concepts, connect them to Rust/Solidity where possible
- Let Taylor make decisions — present options and ask
- After writing code, walk through it and ask if it makes sense

## Git Conventions

- **NEVER add `Co-Authored-By` lines or any AI/Claude attribution to commits.** Taylor is the sole author.

## Code Conventions

- Use React Router's `<Form>` component for mutations
- Use `useLoaderData()` for reading data in components
- Use `useNavigation()` for pending/loading states
- Use `useActionData()` for reading action results
- Keep all DB queries, AI calls, and auth logic in `.server.ts` files
- Use Tailwind utility classes — no CSS modules or styled-components
- Warm, light color theme (cream background, purple/teal accents)
- Rounded corners (rounded-2xl+), soft shadows, child-friendly aesthetic
- Font: Nunito (from Google Fonts)
