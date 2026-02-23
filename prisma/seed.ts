import "dotenv/config";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { styles, themes } from "../storySproutConfig.js";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function seed() {
  console.log("🌱 Seeding styles...");

  for (const style of styles) {
    await prisma.style.upsert({
      where: { slug: style.slug },
      update: {
        name: style.name,
        description: style.description,
        emoji: style.emoji,
      },
      create: {
        name: style.name,
        slug: style.slug,
        description: style.description,
        emoji: style.emoji,
      },
    });
    console.log(`  ✓ ${style.emoji} ${style.name}`);
  }

  console.log("🌱 Seeding themes...");

  for (const theme of themes) {
    await prisma.theme.upsert({
      where: { slug: theme.slug },
      update: {
        name: theme.name,
        description: theme.description,
        emoji: theme.emoji,
      },
      create: {
        name: theme.name,
        slug: theme.slug,
        description: theme.description,
        emoji: theme.emoji,
      },
    });
    console.log(`  ✓ ${theme.emoji} ${theme.name}`);
  }

  console.log("✅ Seeding complete!");
}

seed()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
