import { tryDb } from "~/db.server";
import { rateLimit } from "~/lib/checkout-security.server";
import { isValidEmail, normalizeEmail } from "~/lib/validation";

export async function action({ request }: { request: Request }) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const limited = await rateLimit(request, "newsletter", {
    limit: 8,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return Response.json({ error: limited.error }, { status: 429 });
  }

  const formData = await request.formData();
  const honeypot = String(formData.get("website") ?? "").trim();
  if (honeypot) {
    return Response.json({ success: true });
  }

  const email = normalizeEmail(String(formData.get("email") ?? ""));
  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const db = tryDb();
  if (!db) {
    return Response.json(
      { error: "Newsletter signup is temporarily unavailable." },
      { status: 503 }
    );
  }

  await db.newsletterSubscriber.upsert({
    where: { email },
    create: { email },
    update: {},
  });

  // Also mark existing customer accounts when present.
  await db.customer.updateMany({
    where: { email },
    data: { marketingOptIn: true },
  });

  return Response.json({ success: true });
}
