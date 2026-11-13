import { Resend } from "resend";

let resend: Resend | null = null;

const DEFAULT_FROM = "shiftshappn <orders@shiftshappn.com>";

function getResend() {
  if (!resend) {
    const key = (process.env.RESEND_API_KEY ?? "").trim();
    if (!key) return null;
    resend = new Resend(key);
  }
  return resend;
}

function getFromAddress() {
  return (process.env.EMAIL_FROM ?? DEFAULT_FROM).trim() || DEFAULT_FROM;
}

export async function sendContactMessage(input: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  const supportTo =
    (process.env.SUPPORT_EMAIL ?? process.env.CONTACT_EMAIL ?? "").trim() ||
    "hello@shiftshappn.com";
  const sent = await sendEmail({
    to: supportTo,
    label: "contact form",
    subject: `Contact form: ${input.name}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1C2B36">
        <h1 style="color:#1D4E78;font-family:serif">New contact message</h1>
        <p><strong>From:</strong> ${escapeHtml(input.name)} &lt;${escapeHtml(input.email)}&gt;</p>
        <p style="white-space:pre-wrap">${escapeHtml(input.message)}</p>
      </div>
    `,
  });
  if (!sent) {
    throw new Error("Contact email could not be sent.");
  }
}

async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  bcc?: string[];
  label: string;
}): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.log(`[email] Resend not configured, skipping ${input.label}`);
    return false;
  }

  const { data, error } = await client.emails.send({
    from: getFromAddress(),
    to: input.to,
    bcc: input.bcc,
    subject: input.subject,
    html: input.html,
  });

  if (error) {
    console.error(`[email] ${input.label} failed:`, error.message ?? error);
    return false;
  }

  console.log(`[email] ${input.label} sent`, data?.id ? `(id ${data.id})` : "");
  return true;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendOrderConfirmationEmail({
  to,
  orderNumber,
  total,
  tax,
  taxAmount = 0,
  deliveryCode,
  items,
  siteName,
  timeWindow,
  handover,
  reviewTargets,
}: {
  to: string;
  orderNumber: string;
  total: string;
  tax: string;
  /** When 0, email shows “Inclusive of tax” instead of a tax line. */
  taxAmount?: number;
  deliveryCode?: string | null;
  items: Array<{ name: string; quantity: number; price: string }>;
  siteName?: string | null;
  timeWindow?: string | null;
  handover?: string | null;
  reviewTargets?: Array<{ label: string; href: string }>;
}): Promise<boolean> {
  const itemsHtml = items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0">${escapeHtml(item.name)} × ${item.quantity}</td><td style="padding:8px 0;text-align:right">${escapeHtml(item.price)}</td></tr>`
    )
    .join("");

  const safeSite = siteName ? escapeHtml(siteName) : "";
  const safeWindow = timeWindow ? escapeHtml(timeWindow) : "";
  const dropHtml =
    safeSite || safeWindow
      ? `<p style="margin:0 0 8px"><strong>Shift drop</strong></p>
         ${safeSite ? `<p style="margin:0 0 4px">${safeSite}</p>` : ""}
         ${safeWindow ? `<p style="margin:0 0 12px">${safeWindow}</p>` : ""}`
      : "";

  const handoverHtml = handover
    ? `<p style="color:#1C2B36">${escapeHtml(handover)}</p>`
    : "";

  const deliveryCodeHtml = deliveryCode
    ? `<div style="margin:24px 0;padding:20px;background:#F6F1E9;border-radius:12px;text-align:center">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1D4E78;letter-spacing:0.04em;text-transform:uppercase">Delivery code</p>
        <p style="margin:0 0 10px;font-size:32px;font-weight:700;letter-spacing:0.2em;font-family:ui-monospace,monospace;color:#1C2B36">${escapeHtml(deliveryCode)}</p>
        <p style="margin:0;font-size:14px;color:#1C2B36">Show this code when you receive your order. We enter it to mark the order fulfilled.</p>
      </div>`
    : "";

  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  const policyLinks = `
    <p style="margin:16px 0 0;font-size:13px">
      <a href="${appUrl}/policies/shipping">Delivery</a>
      &nbsp;·&nbsp;
      <a href="${appUrl}/policies/returns">Returns</a>
      &nbsp;·&nbsp;
      <a href="${appUrl}/policies/privacy">Privacy</a>
    </p>`;

  const reviewHtml =
    reviewTargets && reviewTargets.length > 0
      ? `<div style="margin:28px 0;padding:20px;background:#F6F1E9;border-radius:12px">
          <p style="margin:0 0 8px;font-weight:600;color:#1D4E78">How’s the fit?</p>
          <p style="margin:0 0 14px;font-size:14px;color:#1C2B36">
            When you’ve worn them on a shift, leave a quick review — it helps the next nurse find the right size.
          </p>
          ${reviewTargets
            .slice(0, 4)
            .map(
              (target) =>
                `<p style="margin:0 0 8px"><a href="${appUrl}${escapeHtml(target.href)}" style="color:#1D4E78;font-weight:600">Review ${escapeHtml(target.label)} →</a></p>`
            )
            .join("")}
        </div>`
      : "";

  return sendEmail({
    to,
    label: "order confirmation",
    subject: `Order confirmed — ${orderNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1C2B36">
        <h1 style="color:#1D4E78;font-family:serif">Order ${escapeHtml(orderNumber)}</h1>
        <p>Your order is confirmed.</p>
        ${dropHtml}
        ${handoverHtml}
        ${deliveryCodeHtml}
        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          ${itemsHtml}
          ${
            taxAmount <= 0
              ? `<tr><td style="padding:12px 0;border-top:1px solid #F6F1E9">Inclusive of tax</td><td style="padding:12px 0;border-top:1px solid #F6F1E9;text-align:right">—</td></tr>`
              : `<tr><td style="padding:12px 0;border-top:1px solid #F6F1E9">Tax</td><td style="padding:12px 0;border-top:1px solid #F6F1E9;text-align:right">${tax} CAD</td></tr>`
          }
          <tr><td style="padding:12px 0"><strong>Total</strong></td><td style="padding:12px 0;text-align:right"><strong>${total} CAD</strong></td></tr>
        </table>
        ${reviewHtml}
        ${policyLinks}
      </div>
    `,
  });
}

export async function sendGiftCardEmail({
  to,
  code,
  amount,
  note,
  recipientName,
  fromLabel,
  isRecipient = false,
  bcc,
}: {
  to: string;
  code: string;
  amount: string;
  note?: string | null;
  recipientName?: string;
  /** Purchaser display name or email shown to the recipient. */
  fromLabel?: string | null;
  isRecipient?: boolean;
  bcc?: string;
}) {
  const greeting = isRecipient
    ? recipientName
      ? `<p>Hi ${recipientName},</p>`
      : `<p>Hi there,</p>`
    : `<p>Thanks for your purchase.</p>`;

  const sender = fromLabel?.trim();
  const intro = isRecipient
    ? sender
      ? `<p><strong>${escapeHtml(sender)}</strong> sent you a ShiftsHappn e-gift card worth <strong>${amount}</strong>.</p>`
      : `<p>Someone sent you a ShiftsHappn e-gift card worth <strong>${amount}</strong>.</p>`
    : `<p>Your ShiftsHappn e-gift card is ready.</p>`;

  const noteBlock = note
    ? `<p style="margin:16px 0;padding:16px;background:#F6F1E9;border-radius:8px;color:#1C2B36"><em>${escapeHtml(note)}</em></p>`
    : "";

  const fromLine =
    isRecipient && sender
      ? `<p style="color:#666;font-size:14px">From: ${escapeHtml(sender)}</p>`
      : "";

  await sendEmail({
    to,
    bcc: bcc ? [bcc] : undefined,
    label: "gift card email",
    subject: isRecipient
      ? sender
        ? `${sender} sent you a ShiftsHappn gift card`
        : "You received a ShiftsHappn gift card"
      : "Your ShiftsHappn gift card",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1C2B36">
        <h1 style="color:#1D4E78;font-family:serif">ShiftsHappn e-gift card</h1>
        ${greeting}
        ${intro}
        ${fromLine}
        ${noteBlock}
        <p style="font-size:18px;margin:24px 0"><strong>Code:</strong> <code style="background:#F6F1E9;padding:8px 12px;border-radius:6px;font-size:16px">${escapeHtml(code)}</code></p>
        <p style="color:#666">Redeem this code at checkout on shiftshappn.com. Sign in with this email to see the gift under Account → Rewards.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail({
  to,
  resetUrl,
}: {
  to: string;
  resetUrl: string;
}): Promise<boolean> {
  return sendEmail({
    to,
    label: "password reset",
    subject: "Reset your shiftshappn password",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1C2B36">
        <h1 style="color:#1D4E78;font-family:serif">Reset your password</h1>
        <p>We received a request to reset the password for your shiftshappn account.</p>
        <p style="margin:28px 0">
          <a href="${escapeHtml(resetUrl)}"
             style="display:inline-block;padding:12px 20px;background:#1D4E78;color:#fff;text-decoration:none;border-radius:999px;font-weight:600">
            Choose a new password
          </a>
        </p>
        <p style="font-size:13px;color:#666">This link expires in 1 hour. If you didn’t ask for a reset, you can ignore this email.</p>
        <p style="font-size:12px;color:#999;word-break:break-all">${escapeHtml(resetUrl)}</p>
      </div>
    `,
  });
}

export async function sendShippingUpdateEmail({
  to,
  orderNumber,
  reviewTargets,
}: {
  to: string;
  orderNumber: string;
  reviewTargets?: Array<{ label: string; href: string }>;
}) {
  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  const reviewHtml =
    reviewTargets && reviewTargets.length > 0
      ? `<p style="margin:24px 0 8px">Once you’ve worn them on a shift:</p>
         ${reviewTargets
           .slice(0, 3)
           .map(
             (target) =>
               `<p style="margin:0 0 6px"><a href="${appUrl}${escapeHtml(target.href)}" style="color:#1D4E78">Review ${escapeHtml(target.label)} →</a></p>`
           )
           .join("")}`
      : "";

  await sendEmail({
    to,
    label: "shipping update",
    subject: `Your order ${orderNumber} has shipped`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1C2B36">
        <h1 style="color:#1D4E78;font-family:serif">Your scrubs are on the way</h1>
        <p>Order <strong>${escapeHtml(orderNumber)}</strong> has shipped. You'll receive tracking details shortly.</p>
        ${reviewHtml}
      </div>
    `,
  });
}
