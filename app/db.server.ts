import { PrismaNeon, PrismaNeonHTTP } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export function isDatabaseAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function isServerlessRuntime() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // WebSockets from `ws` often fail on Vercel/Lambda and Prisma then throws
  // "External error with reported id was not registered" instead of the real cause.
  if (isServerlessRuntime()) {
    const adapter = new PrismaNeonHTTP(connectionString, {
      arrayMode: false,
      fullResults: true,
    });
    return new PrismaClient({ adapter });
  }

  neonConfig.webSocketConstructor = ws;
  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
}

function clientHasCurrentSchema(client: PrismaClient) {
  return (
    typeof client.catalogColor?.findMany === "function" &&
    typeof client.monthlyOffer?.findMany === "function" &&
    typeof client.giftCard?.findMany === "function" &&
    typeof client.communityPost?.findMany === "function" &&
    typeof client.loyaltyLedger?.findMany === "function"
  );
}

function getPrismaClient(): PrismaClient | null {
  if (!isDatabaseAvailable()) {
    return null;
  }

  if (global.__prisma && clientHasCurrentSchema(global.__prisma)) {
    return global.__prisma;
  }

  if (global.__prisma) {
    void global.__prisma.$disconnect();
    global.__prisma = undefined;
  }

  const client = createPrismaClient();
  global.__prisma = client;
  return client;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient();
    if (!client) {
      throw new Error("DATABASE_URL is not set");
    }
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export function tryDb(): PrismaClient | null {
  return getPrismaClient();
}
