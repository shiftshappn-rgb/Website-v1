import type { Route } from "./+types/contact";
import { Form } from "react-router";
import { Input, Textarea } from "~/components/ui/Input";
import { Button } from "~/components/ui/Button";
import { buildMeta } from "~/lib/seo";

export function meta({}: Route.MetaArgs) {
  return buildMeta({
    title: "Contact — shiftshappn",
    description: "Get in touch with the shiftshappn team. We're here to help with orders, sizing, and more.",
    path: "/contact",
  });
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const name = formData.get("name");
  const email = formData.get("email");
  const message = formData.get("message");

  if (!name || !email || !message) {
    return { error: "Please fill in all fields." };
  }

  // In production, send via email service or CRM integration
  console.log("[contact]", { name, email, message });

  return { success: true };
}

export default function Contact({ actionData }: Route.ComponentProps) {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <h1 className="text-3xl lg:text-4xl font-serif text-navy mb-2">Contact us</h1>
      <p className="text-charcoal/70 mb-8">
        Have a question about your order, sizing, or our products? We'd love to hear from you.
      </p>

      {actionData?.success && (
        <div className="mb-6 p-4 rounded-lg bg-sage/20 text-charcoal text-sm">
          Thanks for reaching out! We'll get back to you within 1–2 business days.
        </div>
      )}

      {actionData?.error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-700 text-sm">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="space-y-5">
        <Input label="Name" name="name" required />
        <Input label="Email" name="email" type="email" required />
        <Textarea label="Message" name="message" required rows={5} />
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
