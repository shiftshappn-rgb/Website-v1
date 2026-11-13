import { createHash } from "node:crypto";
import { tryDb } from "~/db.server";

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("cf-connecting-ip") || "unknown";
}

function requestHost(request: Request): string | null {
  try {
    return new URL(request.url).host.toLowerCase();
  } catch {
    return null;
  }
}

function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  const appUrl = process.env.APP_URL || process.env.SITE_URL;
  if (appUrl) {
    try {
      hosts.add(new URL(appUrl).host.toLowerCase());
    } catch {
      // ignore
    }
  }
  return hosts;
}

/** Reject cross-site POSTs to resource routes (beyond SameSite cookies). */
export function assertSameOrigin(request: Request):
  | { ok: true }
  | { ok: false; error: string } {
  if (request.method === "GET" || request.method === "HEAD") {
    return { ok: true };
  }

  const host = requestHost(request);
  if (!host) return { ok: false, error: "Invalid request origin." };

  const allowed = allowedHosts();
  allowed.add(host);

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (!allowed.has(originHost)) {
        return { ok: false, error: "Invalid request origin." };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Invalid request origin." };
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const refererHost = new URL(referer).host.toLowerCase();
      if (!allowed.has(refererHost)) {
        return { ok: false, error: "Invalid request origin." };
      }
      return { ok: true };
    } catch {
      return { ok: false, error: "Invalid request origin." };
    }
  }

  // Same-site form navigations may omit Origin; allow when neither header is present
  // only for non-API browser navigations. Resource fetch() usually sends Origin.
  return { ok: true };
}

function windowStart(windowMs: number): Date {
  const now = Date.now();
  return new Date(Math.floor(now / windowMs) * windowMs);
}

/**
 * DB-backed sliding fixed-window rate limit. Best-effort on Neon HTTP.
 */
export async function rateLimit(
  request: Request,
  bucket: string,
  opts: { limit: number; windowMs: number }
): Promise<{ ok: true } | { ok: false; error: string; retryAfterSec: number }> {
  const db = tryDb();
  const ip = clientIp(request);
  const key = `${bucket}:${createHash("sha256").update(ip).digest("hex").slice(0, 24)}`;
  const start = windowStart(opts.windowMs);
  const retryAfterSec = Math.ceil(opts.windowMs / 1000);

  if (!db) {
    return { ok: true };
  }

  try {
    const existing = await db.rateLimitBucket.findUnique({
      where: { key_windowStart: { key, windowStart: start } },
    });

    if (!existing) {
      await db.rateLimitBucket.create({
        data: { key, windowStart: start, count: 1 },
      });
      return { ok: true };
    }

    if (existing.count >= opts.limit) {
      return {
        ok: false,
        error: "Too many requests. Please wait and try again.",
        retryAfterSec,
      };
    }

    await db.rateLimitBucket.update({
      where: { id: existing.id },
      data: { count: { increment: 1 } },
    });
    return { ok: true };
  } catch (error) {
    console.error("[rateLimit] failed open:", error);
    return { ok: true };
  }
}

export function jsonError(error: string, status = 400, extra?: Record<string, unknown>) {
  return Response.json({ error, ...extra }, { status });
}
