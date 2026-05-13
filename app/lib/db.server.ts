import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

let prisma: PrismaClient;

declare global {
  var __db__: PrismaClient | undefined;
}

const isProduction = process.env.NODE_ENV === "production";
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : undefined,
};

if (isProduction) {
  const pool = new pg.Pool(poolConfig);
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
} else {
  if (!global.__db__) {
    const pool = new pg.Pool(poolConfig);
    const adapter = new PrismaPg(pool);
    global.__db__ = new PrismaClient({ adapter });
  }
  prisma = global.__db__;
}

export { prisma };
