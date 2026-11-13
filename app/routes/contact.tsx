import type { Route } from "./+types/contact";
import { Form, data } from "react-router";
import { Input, Textarea } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";
import { buildMeta } from "~/lib/seo";
import { rateLimit } from "~/lib/checkout-security.server";
import {
  MAX_NAME_LENGTH,
  isValidEmail,
  normalizeEmail,
  trimToMax,
  validateName,
} from "~/lib/validation";
import { sendContactMessage } from "~/lib/email.server";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Contact — shiftshappn",
    description:
      "Get in touch with the shiftshappn team. We're here to help with orders, sizing, and more.",
    path: "/contact",
  });
}

export async function action({ request }: Route.ActionArgs) {
  const limited = await rateLimit(request, "contact", {
    limit: 5,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return data({ error: limited.error }, { status: 429 });
  }

  const formData = await request.formData();
  const honeypot = String(formData.get("website") ?? "").trim();
  if (honeypot) {
    return { success: true };
  }

  const name = trimToMax(String(formData.get("name") ?? ""), MAX_NAME_LENGTH);
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const message = trimToMax(String(formData.get("message") ?? ""), 5000);

  const nameError = validateName(name);
  if (nameError) return data({ error: nameError }, { status: 400 });
  if (!email || !isValidEmail(email)) {
    return data({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return data({ error: "Message must be at least 10 characters." }, { status: 400 });
  }

  try {
    await sendContactMessage({ name, email, message });
    return { success: true };
  } catch (error) {
    console.error("[contact]", error);
    return data(
      {
        error:
          "We couldn't send your message right now. Please email hello@shiftshappn.com.",
      },
      { status: 503 }
    );
  }
}

export default function Contact({ actionData }: Route.ComponentProps) {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <h1 className="text-3xl lg:text-4xl font-serif text-navy mb-2">Contact us</h1>
      <p className="text-charcoal/70 mb-8">
        Have a question about your order, sizing, or our products? We'd love to hear from you.
      </p>

      {actionData && "success" in actionData && actionData.success ? (
        <div className="mb-6 p-4 rounded-lg bg-sage/20 text-charcoal text-sm" role="status">
          Thanks for reaching out! We'll get back to you within 1–2 business days.
        </div>
      ) : null}

      {actionData && "error" in actionData && actionData.error ? (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm" role="alert">
          {actionData.error}
        </div>
      ) : null}

      <Form method="post" className="space-y-5">
        <div className="hidden" aria-hidden="true">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <Input label="Name" name="name" required maxLength={MAX_NAME_LENGTH} />
        <Input label="Email" name="email" type="email" required />
        <Textarea label="Message" name="message" required rows={5} maxLength={5000} />
        <Button type="submit" variant="terracotta">
          Send message
        </Button>
      </Form>

      <div className="mt-12 pt-8 border-t border-charcoal/10 text-sm text-charcoal/70">
        <p className="font-medium text-charcoal mb-2">Other ways to reach us</p>
        <p>Email: hello@shiftshappn.com</p>
        <p className="mt-1">Hours: Mon–Fri, 9am–5pm ET</p>
      </div>
    </div>
  );
}
