# Session Notes — March 5, 2026

## What happened this session

Taylor is prepping for a **Playlab Fullstack Engineer interview**. This session focused on interview prep strategy and updating CLAUDE.md with full context.

### Key updates:
1. **CLAUDE.md updated** with Taylor's background, project portfolio (StudyFlow, Haze, PilotFlow, Leanlab Larry, StorySprout), interview format details from Wyman at Playlab, prep priorities, key strengths to highlight, and teaching approach instructions.

2. **Interview prep priorities identified** (in order):
   - React fundamentals (hooks, state, rendering, data flow)
   - Walkthrough readiness (explain architecture/tradeoffs confidently)
   - Pairing readiness (code out loud, narrate decisions)
   - Reading unfamiliar code
   - Playlab-specific knowledge

3. **DrBeat / Producer Pal exploration** — Taylor mentioned wanting to look at Playlab's open-source codebase (DrBeat on GitHub, which may have been renamed to Producer Pal). This couldn't be done in this cloud session since only StorySprout is mounted. Taylor plans to clone it locally and explore with Claude Code there.

## What to do next

1. **Merge branch to master** — The branch `claude/playlab-interview-quiz-t6Lbm` has one commit ahead of master (CLAUDE.md update). Couldn't push to master from this environment (403). Run locally:
   ```bash
   git fetch origin claude/playlab-interview-quiz-t6Lbm
   git checkout master
   git merge origin/claude/playlab-interview-quiz-t6Lbm
   git push origin master
   ```

2. **Explore Playlab's codebase** — Clone DrBeat/Producer Pal from GitHub and walk through it. Key things to look for:
   - Remix patterns (loaders, actions, nested routes)
   - How they handle WebSockets
   - Database schema and data flow
   - AI integration patterns
   - Testing approach

3. **Start interview prep drills** — Quiz Taylor on:
   - React hooks (useState, useEffect, useRef, useMemo, useCallback) — when to use each, gotchas
   - Remix/React Router data flow (loader → component → action cycle)
   - How StorySprout's architecture works and why decisions were made
   - Reading unfamiliar code and narrating reasoning

4. **Mock walkthrough practice** — Have Taylor explain StorySprout or StudyFlow architecture as if presenting to Playlab interviewers. Push back like a real interviewer would.

## Taylor's context

- Based in Chicago, former music teacher turned ed-tech engineer
- 10+ years in ed-tech (Spotify/Soundtrap → Leanlab Education)
- PilotFlow literally started as a Playlab prototype — strong connection to highlight
- Learning trajectory: no-code → TypeScript/React/Next.js → currently learning Rust
- Strongest project: StudyFlow (production, sole engineer)
- Prefers to be quizzed and challenged, not just given answers
