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

export async function sendOrderConfirmationEmail({
  to,
  orderNumber,
  total,
  items,
}: {
  to: string;
  orderNumber: string;
  total: string;
  items: Array<{ name: string; quantity: number; price: string }>;
}) {
  const client = getResend();
  if (!client) {
    console.log("[email] Resend not configured, skipping order confirmation");
    return;
  }

  const itemsHtml = items
    .map(
      (item) =>
        `<tr><td style="padding:8px 0">${item.name} × ${item.quantity}</td><td style="padding:8px 0;text-align:right">${item.price}</td></tr>`
    )
    .join("");

  await client.emails.send({
    from: "shiftshappn <orders@shiftshappn.com>",
    to,
    subject: `Order confirmed — ${orderNumber}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1C2B36">
        <h1 style="color:#1D4E78;font-family:serif">Thank you for your order</h1>
        <p>Your order <strong>${orderNumber}</strong> has been confirmed.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          ${itemsHtml}
          <tr><td style="padding:12px 0;border-top:1px solid #F6F1E9"><strong>Total</strong></td><td style="padding:12px 0;border-top:1px solid #F6F1E9;text-align:right"><strong>${total}</strong></td></tr>
        </table>
        <p style="color:#666">We'll send you a shipping update when your scrubs are on their way.</p>
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
