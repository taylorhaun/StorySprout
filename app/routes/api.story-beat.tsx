import { requireUser } from "../lib/auth.server.js";
import { prisma } from "../lib/db.server.js";
import type { Route } from "./+types/api.story-beat";

// Stub — will be replaced with real story engine in Phase 2
export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const body = await request.json();
  const { storyId, chosenOption } = body;

  // Verify story belongs to user
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    include: { beats: { orderBy: { beatNumber: "asc" } }, style: true, theme: true },
  });

  if (!story || story.userId !== user.id) {
    return Response.json({ error: "Story not found" }, { status: 404 });
  }

  if (story.isComplete) {
    return Response.json({ error: "Story is already complete" }, { status: 400 });
  }

  // If there's a chosenOption, update the previous beat
  if (chosenOption && story.beats.length > 0) {
    const lastBeat = story.beats[story.beats.length - 1];
    await prisma.storyBeat.update({
      where: { id: lastBeat.id },
      data: { chosenOption },
    });
  }

  const nextBeatNumber = story.beats.length + 1;

  // STUB: Return placeholder beat until ai.server.ts is implemented
  const stubSegment =
    nextBeatNumber === 5
      ? `And so our friend settled in for a cozy rest, feeling happy and warm. The stars twinkled softly overhead as the world grew quiet and peaceful. What a wonderful adventure it had been!`
      : `This is beat ${nextBeatNumber} of the story. The ${story.theme.name.toLowerCase()} adventure continues in ${story.style.name} style!`;

  const stubQuestion =
    nextBeatNumber < 5 ? "What should happen next?" : null;
  const stubOptions =
    nextBeatNumber < 5 ? ["Option A", "Option B"] : [];

  const newBeat = await prisma.storyBeat.create({
    data: {
      storyId: story.id,
      beatNumber: nextBeatNumber,
      segment: stubSegment,
      question: stubQuestion,
      options: stubOptions,
      provider: "stub",
    },
  });

  // Update story progress
  await prisma.story.update({
    where: { id: story.id },
    data: {
      currentBeat: nextBeatNumber,
      isComplete: nextBeatNumber === 5,
    },
  });

  return Response.json(newBeat);
}
