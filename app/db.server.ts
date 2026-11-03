import { PrismaNeon, PrismaNeonHTTP } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import { Prisma, PrismaClient } from "@prisma/client";
import ws from "ws";

/** Bump when Prisma schema gains fields that must invalidate a cached client. */
const PRISMA_CLIENT_SCHEMA_VERSION = 5;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaSchemaVersion: number | undefined;
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

  if (
    global.__prisma &&
    global.__prismaSchemaVersion === PRISMA_CLIENT_SCHEMA_VERSION &&
    clientHasCurrentSchema(global.__prisma)
  ) {
    return global.__prisma;
  }

  if (global.__prisma) {
    void global.__prisma.$disconnect();
    global.__prisma = undefined;
  }

  const client = createPrismaClient();
  global.__prisma = client;
  global.__prismaSchemaVersion = PRISMA_CLIENT_SCHEMA_VERSION;
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

/** True when using PrismaNeonHTTP (no interactive / batch $transaction support). */
export function isHttpDbAdapter() {
  return isServerlessRuntime();
}

/**
 * Run work in a Prisma interactive transaction when the adapter supports it.
 * On Vercel/Neon HTTP, falls back to sequential queries on the root client.
 */
export async function runWithDbTransaction<T>(
  client: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (isHttpDbAdapter()) {
    return fn(client);
  }
  return client.$transaction(fn);
}

/**
 * Run a list of Prisma writes as a batch transaction when supported.
 * On Neon HTTP, awaits each operation in order instead.
 */
export async function runDbBatch<T>(
  client: PrismaClient,
  operations: Array<Prisma.PrismaPromise<T>>
): Promise<T[]> {
  if (operations.length === 0) return [];
  if (isHttpDbAdapter()) {
    const results: T[] = [];
    for (const operation of operations) {
      results.push(await operation);
    }
    return results;
  }
  return client.$transaction(operations);
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Prisma 6 wraps updateMany/createMany in an internal transaction, which Neon HTTP
 * rejects ("Transactions are not supported in HTTP mode"). Prefer these helpers
 * on Vercel, or any path that may run under PrismaNeonHTTP.
 */
export async function updateByIds(
  ids: string[],
  updateOne: (id: string) => Promise<unknown>
): Promise<{ count: number }> {
  let count = 0;
  for (const id of ids) {
    await updateOne(id);
    count += 1;
  }
  return { count };
}

export async function createEach<T>(
  rows: T[],
  createOne: (row: T) => Promise<unknown>,
  options?: { skipDuplicates?: boolean }
): Promise<{ count: number }> {
  let count = 0;
  for (const row of rows) {
    try {
      await createOne(row);
      count += 1;
    } catch (error) {
      if (options?.skipDuplicates && isUniqueConflict(error)) continue;
      throw error;
    }
  }
  return { count };
}
