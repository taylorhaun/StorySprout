# StorySprout

Interactive AI bedtime story app for kids ages 3-5. Pick a storytelling style, choose a theme, and play through a 5-beat choose-your-own-adventure story with AI-generated text that streams in real-time.

## What it does

A parent picks a **style** (Whimsical Rhyme, Calm Bedtime, or Silly & Goofy) and a **theme** (Penguins, Space, Ocean, etc.), then the app generates an interactive story in 5 beats:

1. **Meet the Friend** — introduces the character and setting
2. **Something Happens** — a fun, surprising event
3. **Try a Thing** — the character explores or attempts something
4. **Big Hooray** — the happy climax
5. **Cozy Ending** — calm wrap-up, no choices, just sleepy vibes

At each beat (except the last), the child picks between two choices that shape what happens next. All content is validated for age-appropriateness — no scary stuff, no villains, no sadness.

## Tech stack

- **React Router v7** (full-stack, SSR) with TypeScript
- **Anthropic Claude / OpenAI** — dual AI provider, switchable via env var
- **Server-Sent Events** for streaming story text to the client in real-time
- **PostgreSQL** via Prisma ORM
- **Tailwind CSS v4** — warm, rounded, child-friendly UI
- **Docker Compose** for local Postgres

## Architecture highlights

**Streaming JSON extraction** — The AI returns structured JSON (`{beat, segment, question, options}`), but we want to stream the story text live. The server parses the JSON as it streams in, extracts just the `segment` value in real-time, and sends only the story prose to the client via SSE. The full JSON is validated after the stream completes.

**Multi-layer content safety** — Primary safety is prompt-level (the AI is instructed to never generate scary/violent content). Backup is a Zod validation pipeline + keyword blocklist that catches anything that slips through. Both choice options are required to lead to equally positive outcomes.

**Retry with fallback** — If the streamed response fails validation (bad JSON, missing fields, blocked word), the engine automatically retries with a non-streaming request. The user sees a brief pause but gets a valid beat.

## Project structure

```
app/
  routes/
    home.tsx              # Landing page
    library.tsx           # Story history — in-progress and completed
    story.new.tsx         # Pick style + theme
    story.$storyId.tsx    # Story playback with streaming
    api.story-beat.tsx    # SSE endpoint for beat generation
  lib/
    ai.server.ts          # Anthropic + OpenAI abstraction (streaming + non-streaming)
    story-engine.server.ts # Orchestrator — prompts, AI calls, validation, DB writes
    story-prompts.server.ts # System prompts per style and beat
    validators.server.ts  # Zod schemas + content safety blocklist
    auth.server.ts        # Session cookies + bcrypt
    db.server.ts          # Prisma client singleton
```

## Running locally

```bash
# Start Postgres
docker compose up -d postgres

# Install deps + set up DB
npm install
npx prisma generate
npx prisma migrate dev
npx prisma db seed

# Copy env and add your API keys
cp .env.example .env

# Start dev server
npm run dev
```

App runs at `http://localhost:5555`.

## Env vars

| Variable | What it does |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | Signs session cookies |
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `AI_PROVIDER` | `"anthropic"` (default) or `"openai"` |
