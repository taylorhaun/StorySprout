import { requireUser } from "../lib/auth.server.js";
import { prisma } from "../lib/db.server.js";
import {
  buildPromptCtx,
  createBeatStream,
  updatePreviousBeat,
} from "../lib/story-engine.server.js";
import {
  buildSystemPrompt,
  buildUserMessage,
} from "../lib/story-prompts.server.js";
import type { Route } from "./+types/api.story-beat";

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const body = await request.json();
  const { storyId, chosenOption } = body;

  // Verify story belongs to user
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    include: {
      beats: { orderBy: { beatNumber: "asc" } },
      style: true,
      theme: true,
    },
  });

  if (!story || story.userId !== user.id) {
    return Response.json({ error: "Story not found" }, { status: 404 });
  }

  if (story.isComplete) {
    return Response.json(
      { error: "Story is already complete" },
      { status: 400 }
    );
  }

  // Update previous beat with child's choice (before streaming starts)
  await updatePreviousBeat(story, chosenOption ?? null);

  // Build prompts
  const { promptCtx, nextBeatNumber } = buildPromptCtx(
    story,
    chosenOption ?? null
  );
  const systemPrompt = buildSystemPrompt(promptCtx);
  const userMessage = buildUserMessage(promptCtx);

  // Return SSE stream
  const stream = createBeatStream(
    story,
    nextBeatNumber,
    systemPrompt,
    userMessage
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
