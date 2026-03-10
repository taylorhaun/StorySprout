# StorySprout — Claude Code Instructions

## About Taylor

Taylor Haun is a fullstack engineer and former educator based in Chicago. Background: music teacher → Spotify/Soundtrap (grew education product from 800 to 600K seats in LAUSD) → Leanlab Education (Director of School R&D). 10+ years in ed-tech. Learning trajectory: started with no-code tools → TypeScript/React/Next.js → currently learning Rust.

### Taylor's Projects (strongest → learning)

1. **StudyFlow** — Production research study management platform for Leanlab Education. Next.js 15, React 19, TypeScript, PostgreSQL, Tailwind. Sole engineer. Live at studyflow.leanlabeducation.org. This is Taylor's most substantial project.
2. **Haze** — Social place discovery iOS app. React, Vite, Supabase, Capacitor (iOS), OpenAI API, Google Maps/Places API. AI-powered extraction from Instagram posts/screenshots.
3. **PilotFlow** — AI-powered research design tool for educators. LLM APIs (Claude, OpenAI). Originated as a Playlab prototype, evolved into a custom tool within StudyFlow. Finalist for Renaissance Philanthropy AI Talent Accelerator.
4. **Leanlab Larry** — Agentic AI assistant using Claude API + MCP, orchestrates across 7 integrated systems for 25+ concurrent research projects.
5. **StorySprout** (this repo) — AI bedtime story app for ages 3-5. React Router v7, TypeScript, PostgreSQL, Prisma. Learning project to get deeper with React/Remix patterns.

### Current Goal: Playlab Interview Prep

Taylor is interviewing for **Fullstack Engineer** at **Playlab** (tech non-profit, AI tools for educators). Playlab's stack: **TypeScript, Remix (React), Node, PostgreSQL, AWS, Docker, WebSockets**.

**Interview format** (per Wyman at Playlab):
- Walk throughs (could be Taylor's projects OR Playlab's codebase)
- Paired programming with an engineer
- Interviews with core eng team members

**Prep priorities:**
1. **React fundamentals** — hooks, state, rendering, data flow. Must be fluent, not just familiar.
2. **Walkthrough readiness** — be able to explain StudyFlow, Haze, or StorySprout architecture, tradeoffs, and decisions clearly and confidently.
3. **Pairing readiness** — practice coding out loud, narrating decisions, asking clarifying questions, taking feedback.
4. **Reading unfamiliar code** — be able to walk through a codebase you haven't seen and reason about it.
5. **Playlab-specific knowledge** — understand their product, mission (AI tools for educators), and how Taylor's ed-tech background connects.

**Key strengths to highlight in interview:**
- PilotFlow literally originated as a Playlab prototype
- 10+ years in ed-tech, understands the user (educators + students)
- Shipped production apps as sole engineer (StudyFlow)
- Experience with LLM APIs (Claude, OpenAI) across multiple projects
- Spotify scaling experience (800 → 600K seats)

**When working with Taylor:**
- Quiz and challenge — don't just give answers, make Taylor reason through things
- Do mock walkthroughs and mock pairing sessions when asked
- Flag gaps in understanding honestly so Taylor can address them before the interview
- Connect new concepts to things Taylor already knows (Next.js, Supabase, Rust where relevant)

## Project Overview

StorySprout is an interactive AI bedtime story app for ages 3-5. Users pick a **style** and **theme**, then play through a structured 5-beat story arc with simple choose-your-own-adventure choices at each step.

This project was bootstrapped from [ChattyKathys](../ChattyKathys/) and shares the same tech stack.

## Tech Stack

- **Framework:** React Router v7 (formerly Remix) — loaders, actions, nested routes
- **Language:** TypeScript (strict mode) — full stack
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** Custom session cookies + bcrypt; Google + GitHub OAuth planned via `remix-auth`
- **AI:** Anthropic Claude SDK + OpenAI SDK (dual provider, selected via `AI_PROVIDER` env var)
- **Image Generation:** OpenAI GPT Image 1 Mini — one illustration per beat, saved to disk
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
- Each beat is 50-70 words max
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
- `app/lib/ai.server.ts` — AI provider abstraction (Anthropic + OpenAI, streaming + non-streaming)
- `app/lib/story-engine.server.ts` — beat progression, SSE streaming, DB writes, image triggering
- `app/lib/story-prompts.server.ts` — system prompt templates per style/beat
- `app/lib/validators.server.ts` — Zod schemas + content safety blocklist
- `app/lib/image-engine.server.ts` — OpenAI image generation, style spines, file saving

### Streaming Beat Generation + Async Image Generation
Beat text is streamed to the client via SSE. The server parses JSON as it streams, extracts just the `segment` value in real-time, and sends story prose to the client. After the text completes, the server triggers image generation via OpenAI and sends the image URL as a follow-up SSE event. The UI shows the text immediately with a "Painting the scene..." placeholder that resolves when the image is ready.

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
│   ├── story.$storyId.tsx    # Story playback — full-screen picture book UI
│   └── api.story-beat.tsx    # API: generate next beat (resource route)
├── components/               # (to be added as needed)
├── lib/
│   ├── db.server.ts          # Prisma client singleton
│   ├── auth.server.ts        # Session, cookies, bcrypt
│   ├── ai.server.ts          # Anthropic + OpenAI text generation
│   ├── story-engine.server.ts # Beat orchestration, SSE streaming, image triggering
│   ├── story-prompts.server.ts # System prompts per style/beat
│   ├── validators.server.ts  # Zod schemas + content safety
│   └── image-engine.server.ts # OpenAI image gen, style spines, file saving
└── app.css                   # Tailwind v4 import + theme
```

## Database

Five tables: `users`, `styles`, `themes`, `stories`, `story_beats`.

- Styles and themes are seeded (not user-created). Seed data lives in `storySproutConfig.ts`.
- Stories track `currentBeat` (1-5), `isComplete`, and `characterDescription` (extracted from beat 1 for image prompt consistency).
- StoryBeats store `segment`, `question`, `options` (text[]), `chosenOption`, `rawJson` for debugging, and `imageLeftUrl` for the generated illustration.
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
- `OPENAI_API_KEY` — OpenAI API key (used for story text when `AI_PROVIDER=openai`, and always for image generation)
- `AI_PROVIDER` — `"anthropic"` (default) or `"openai"`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — for Google OAuth (optional until implemented)
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — for GitHub OAuth (optional until implemented)

## Content Safety

This app is for children aged 3-5. All AI-generated content must be:
- Age-appropriate — simple vocabulary, short sentences
- Positive — no violence, danger, sadness, fear, villains, darkness
- Safe — both choice options lead to equally happy outcomes
- Bounded — max 70 words per beat segment

Safety is enforced at the prompt level (primary) and via keyword blocklist validation (backup).

## Teaching Approach

Taylor is preparing for a fullstack engineering interview. The approach should shift depending on context:

**When building features in StorySprout:**
- Explain what we're doing and why at each step
- Check Taylor's understanding regularly
- When introducing new concepts, connect them to Next.js/Supabase patterns Taylor already knows
- Let Taylor make decisions — present options and ask
- After writing code, walk through it and ask if it makes sense

**When doing interview prep:**
- Quiz Taylor on concepts — don't just explain, make Taylor answer first
- Do mock walkthroughs where Taylor explains architecture and Claude pushes back like an interviewer
- Do mock pairing where Taylor codes while narrating, and Claude gives real-time feedback
- Be direct about gaps — if Taylor can't explain something, flag it as a study area
- Practice reading unfamiliar code and reasoning about it out loud

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
