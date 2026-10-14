import { Resend } from "resend";

let resend: Resend | null = null;

function getResend() {
  if (!resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    resend = new Resend(key);
  }
  return resend;
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
  items,
  siteName,
  timeWindow,
  handover,
}: {
  to: string;
  orderNumber: string;
  total: string;
  tax: string;
  items: Array<{ name: string; quantity: number; price: string }>;
  siteName?: string | null;
  timeWindow?: string | null;
  handover?: string | null;
}): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.log("[email] Resend not configured, skipping order confirmation");
    return false;
  }

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

  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  const policyLinks = `
    <p style="margin:16px 0 0;font-size:13px">
      <a href="${appUrl}/policies/shipping">Delivery</a>
      &nbsp;·&nbsp;
      <a href="${appUrl}/policies/returns">Returns</a>
      &nbsp;·&nbsp;
      <a href="${appUrl}/policies/privacy">Privacy</a>
    </p>`;

  await client.emails.send({
    from: "shiftshappn <orders@shiftshappn.com>",
    to,
    subject: `Order confirmed — ${orderNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1C2B36">
        <h1 style="color:#1D4E78;font-family:serif">Order ${escapeHtml(orderNumber)}</h1>
        <p>Your order is confirmed.</p>
        ${dropHtml}
        ${handoverHtml}
        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          ${itemsHtml}
          <tr><td style="padding:12px 0;border-top:1px solid #F6F1E9">HST</td><td style="padding:12px 0;border-top:1px solid #F6F1E9;text-align:right">${tax} CAD</td></tr>
          <tr><td style="padding:12px 0"><strong>Total</strong></td><td style="padding:12px 0;text-align:right"><strong>${total} CAD</strong></td></tr>
        </table>
        ${policyLinks}
      </div>
    `,
  });

  return true;
}

export async function sendGiftCardEmail({
  to,
  code,
  amount,
  note,
  recipientName,
  isRecipient = false,
  bcc,
}: {
  to: string;
  code: string;
  amount: string;
  note?: string | null;
  recipientName?: string;
  isRecipient?: boolean;
  bcc?: string;
}) {
  const client = getResend();
  if (!client) {
    console.log("[email] Resend not configured, skipping gift card email");
    return;
  }

  const greeting = isRecipient
    ? recipientName
      ? `<p>Hi ${recipientName},</p>`
      : `<p>Hi there,</p>`
    : `<p>Thanks for your purchase.</p>`;

  const intro = isRecipient
    ? `<p>Someone sent you a ShiftsHappn e-gift card worth <strong>${amount}</strong>.</p>`
    : `<p>Your ShiftsHappn e-gift card is ready.</p>`;

  const noteBlock = note
    ? `<p style="margin:16px 0;padding:16px;background:#F6F1E9;border-radius:8px;color:#1C2B36"><em>${note}</em></p>`
    : "";

  await client.emails.send({
    from: "shiftshappn <orders@shiftshappn.com>",
    to,
    bcc: bcc ? [bcc] : undefined,
    subject: isRecipient
      ? "You received a ShiftsHappn gift card"
      : "Your ShiftsHappn gift card",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1C2B36">
        <h1 style="color:#1D4E78;font-family:serif">ShiftsHappn e-gift card</h1>
        ${greeting}
        ${intro}
        ${noteBlock}
        <p style="font-size:18px;margin:24px 0"><strong>Code:</strong> <code style="background:#F6F1E9;padding:8px 12px;border-radius:6px;font-size:16px">${code}</code></p>
        <p style="color:#666">Redeem this code at checkout on shiftshappn.com. Balance can be checked on the gift cards page.</p>
      </div>
    `,
  });
}

export async function sendShippingUpdateEmail({
  to,
  orderNumber,
}: {
  to: string;
  orderNumber: string;
}) {
  const client = getResend();
  if (!client) return;

  await client.emails.send({
    from: "shiftshappn <orders@shiftshappn.com>",
    to,
    subject: `Your order ${orderNumber} has shipped`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1C2B36">
        <h1 style="color:#1D4E78;font-family:serif">Your scrubs are on the way</h1>
        <p>Order <strong>${orderNumber}</strong> has shipped. You'll receive tracking details shortly.</p>
      </div>
    `,
  });
}
