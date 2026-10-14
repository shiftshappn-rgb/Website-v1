export const STORE_POLICIES = [
  {
    slug: "shipping",
    title: "Delivery & Shipping",
    content: `
<h2>At a glance</h2>
<table>
  <thead><tr><th>Question</th><th>Answer</th></tr></thead>
  <tbody>
    <tr><td>Delivery cost</td><td>$0. Always.</td></tr>
    <tr><td>Who delivers</td><td>The ShiftsHappn team, in person.</td></tr>
    <tr><td>Where</td><td>The Shift Drop site you choose at checkout, at hospitals across the Halifax Regional Municipality.</td></tr>
    <tr><td>When</td><td>The site and time window on your order confirmation.</td></tr>
    <tr><td>Miss your drop?</td><td>We move your order to the next drop, free.</td></tr>
    <tr><td>Change your mind before pickup?</td><td>Cancel for a full refund.</td></tr>
  </tbody>
</table>
<h2>1. How Shift Drop works</h2>
<p>ShiftsHappn doesn't ship. Every order is hand-delivered by our team at a scheduled Shift Drop at your hospital, so delivery is always free and there is no carrier in the middle.</p>
<p>Shift Drop is in-person delivery at hospital sites across the Halifax Regional Municipality (HRM). When you order, you pick the site and time window that suit your shift. We bring your order to that site during the window and hand it to you directly. Your confirmation email repeats the site and window. We do not publish a separate drop calendar until each hospital has agreed to handover on site.</p>
<h2>2. Cost</h2>
<p>Delivery is free on every order. You pay the price shown for your items plus any applicable HST, all in Canadian dollars, and nothing else.</p>
<h2>3. Your delivery date</h2>
<p>Your order confirmation email shows your Shift Drop site and time window. That is your delivery arrangement.</p>
<p>For Founding 100 and other pre-orders, the confirmation shows the drop we expect your order to make. If that changes, we email you as soon as we know, with the new date and the option to cancel for a full refund.</p>
<h2>4. Picking up your order</h2>
<p>Bring your order number. The confirmation email on your phone is fine.</p>
<p>Pickup is in person. To send a coworker instead, reply to your confirmation email with their name before the drop.</p>
<p>Check your items at the drop. If anything is wrong, tell us there, or within 7 days under our <a href="/policies/returns">Returns, Exchanges &amp; Replacements Policy</a>.</p>
<p>Once your order is handed over, it's yours, and so is the responsibility for it.</p>
<h2>5. If you miss your drop</h2>
<p>Shifts run late. If you can't make your drop, let us know and we'll move your order to any upcoming drop at no cost. If you miss it without telling us, we'll email you and do the same.</p>
<p>We hold unclaimed orders for 90 days from the original drop date. After that, we cancel the order and refund you in full to your original payment method.</p>
<h2>6. If we change or cancel a drop</h2>
<p>Weather, site access, or a hospital emergency can force us to move a drop. When that happens, we notify you by email (and by text if you've opted in) at least 24 hours ahead whenever possible. Your order moves to the next drop automatically, or you can cancel for a full refund.</p>
<p>If we fail to deliver within 30 days of your confirmed drop date, you may cancel for a full refund, as Nova Scotia law provides.</p>
<h2>7. Cancelling an order</h2>
<p>You can cancel any order for a full refund at any time before it's handed to you at a drop. Email <a href="mailto:hello@shiftshappn.com">hello@shiftshappn.com</a> with your order number. The exception is personalized items (for example, embroidered RN or LPN titles) once personalization has started.</p>
<h2>8. Payment and order confirmation</h2>
<p>Payment is taken in full when you order, by card through Stripe. Card orders are confirmed when the order is placed.</p>
<h2>9. Outside HRM</h2>
<p>Shift Drop currently serves HRM hospital sites only, and we don't mail orders. If you work somewhere we don't drop yet, email us. Requests decide where Shift Drop goes next.</p>
<h2>10. Contact</h2>
<p>ShiftsHappn. Mailing address: to be confirmed. Phone: to be confirmed. Email: <a href="mailto:hello@shiftshappn.com">hello@shiftshappn.com</a>.</p>
`,
  },
  {
    slug: "returns",
    title: "Returns, Exchanges & Replacements",
    content: `
<h2>At a glance</h2>
<table>
  <thead><tr><th>Situation</th><th>What you get</th><th>Window</th><th>Condition</th></tr></thead>
  <tbody>
    <tr><td>Wrong size or colour</td><td>Free exchange</td><td>30 days from pickup</td><td>Unworn, unwashed, tags on</td></tr>
    <tr><td>Changed your mind</td><td>Full refund</td><td>30 days from pickup</td><td>Unworn, unwashed, tags on</td></tr>
    <tr><td>Wrong item, or damaged at the drop</td><td>Replacement</td><td>Tell us within 7 days</td><td>None</td></tr>
    <tr><td>Defect (seam, zipper, snap, fabric)</td><td>Replacement, or a refund if we can't replace it</td><td>90 days from pickup</td><td>Worn and washed per the care label is fine</td></tr>
    <tr><td>Personalized items, opened underscrubs or socks</td><td>Final sale</td><td>n/a</td><td>Covered only if defective</td></tr>
  </tbody>
</table>
<p>Wrong size is fixed hand to hand at the next Shift Drop, at no cost, with no mailing.</p>
<h2>1. Free size and colour exchanges</h2>
<p>If it doesn't fit or the colour isn't right, exchange it within 30 days of pickup. Try it on at home, but don't wear it on shift or wash it, and leave the tags on.</p>
<p>Bring it to any upcoming Shift Drop and leave with the new size. If we don't have your size with us, we reserve it for the next drop, or you can take a refund instead.</p>
<h2>2. Refunds</h2>
<p>If you change your mind, return unworn, unwashed items with tags on within 30 days of pickup for a full refund. Refunds go back to your original payment method, to your card through Stripe. We issue the refund within 5 business days of getting the items back. Your bank may take a few more days to show it.</p>
<p>We don't offer store credit. Your money comes back as money.</p>
<h2>3. Replacements for our mistakes</h2>
<p>If we hand you the wrong item, or it's damaged when you get it, tell us at the drop or within 7 days. We replace it at the next drop, at no cost.</p>
<h2>4. Quality guarantee: 90 days</h2>
<p>If a seam splits, a zipper or snap fails, or the fabric breaks down within 90 days of pickup, we replace it, even if you've worn and washed it. If we can't replace it, we refund it. Send a photo with your claim.</p>
<p>Not covered: normal wear, snags and tears from accidents, stains, alterations, or damage from bleach, high heat, or anything else the care label says to avoid.</p>
<h2>5. Final sale items</h2>
<p>These can't be returned or exchanged unless they're defective:</p>
<ul>
  <li>Personalized items, such as embroidered RN or LPN titles</li>
  <li>Underscrubs and socks once the packaging is opened, for hygiene reasons</li>
</ul>
<h2>6. Bundles and gift items</h2>
<p>Items in a bundle can be exchanged one at a time. A refund on a bundle covers the whole bundle, returned together.</p>
<p>Founding 100 gift items (tote, socks, badge holder, pen) are yours to keep, even if you return your order.</p>
<h2>7. How to start a return, exchange, or claim</h2>
<ol>
  <li>Email <a href="mailto:hello@shiftshappn.com">hello@shiftshappn.com</a> or DM @shiftshappn with your order number, the item, and what you need.</li>
  <li>We reply within 2 business days with the drop where you can hand it over.</li>
  <li>Bring the item to that drop. If you can't make any upcoming drop, tell us and we'll work something out.</li>
</ol>
<p>Please talk to us before disputing a charge with your bank. We'll fix it faster.</p>
<h2>8. Your rights</h2>
<p>This policy adds to, and doesn't limit, any rights you have under Nova Scotia law.</p>
`,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    content: `
<h2>At a glance</h2>
<table>
  <thead><tr><th>What we collect</th><th>Why</th><th>Who else handles it</th><th>How long we keep it</th></tr></thead>
  <tbody>
    <tr><td>Name, email, phone, order details</td><td>To process and deliver your order</td><td>Stripe, our website host, Resend (email)</td><td>Six years, as tax law requires</td></tr>
    <tr><td>Your Shift Drop site and sizes</td><td>To bring the right order to the right place</td><td>Nobody outside ShiftsHappn</td><td>With your order record</td></tr>
    <tr><td>Card details</td><td>To take payment</td><td>Stripe only. We never see or store your full card number</td><td>Held by Stripe under its own policy</td></tr>
    <tr><td>Survey and feedback answers</td><td>To design better scrubs</td><td>Nobody outside ShiftsHappn</td><td>Names and emails removed after two years, unless you're a customer</td></tr>
    <tr><td>Your email or number for news</td><td>To send updates you asked for</td><td>Resend, or our text provider if you opt in to texts</td><td>Until you unsubscribe</td></tr>
  </tbody>
</table>
<p>ShiftsHappn collects only what it needs to make, sell, and deliver scrubs, never sells it, and tells you where it goes.</p>
<h2>1. Who we are</h2>
<p>ShiftsHappn is a scrubs brand based in the Halifax Regional Municipality, Nova Scotia. Our Privacy Officer (name to be confirmed) is responsible for how we handle your information and can be reached at <a href="mailto:privacy@shiftshappn.com">privacy@shiftshappn.com</a>.</p>
<p>Effective date: to be confirmed.</p>
<h2>2. What we collect</h2>
<p>When you order: your name, email, phone number if you give it, Shift Drop site, sizes, and what you bought.</p>
<p>When you pay: card payments are handled entirely by Stripe. We never see or store your full card number.</p>
<p>When you answer a survey or give feedback: your role, age group, sizes, preferences, and comments. Optional questions are optional.</p>
<p>When you message us: what you send by email or Instagram DM, including photos for a quality claim.</p>
<p>When you visit shiftshappn.com: basic technical data such as browser type and pages visited, and cookies needed for the cart, checkout, and signed-in session. We do not run advertising pixels or a separate analytics product on the site.</p>
<p>Please never send us patient information or photos that show patients or patient records.</p>
<h2>3. How we use it</h2>
<p>We use your information to take payment, deliver your order at Shift Drop, handle exchanges and claims, answer your messages, improve our products, and send updates you've agreed to receive. We don't use it for anything else without asking you first.</p>
<h2>4. Who we share it with</h2>
<p>We never sell or rent your information. We share it only with service providers that help us run the business: Stripe (payments), Resend (email), and our website host. They may use it only to provide their service to us. We do not name an invoicing tool here because we have not chosen one.</p>
<p>Some of these providers store data outside Canada, including in the United States. While it's there, it may be accessed by courts, law enforcement, or national security authorities in that country.</p>
<p>We may also disclose information where the law requires it.</p>
<h2>5. Emails and texts</h2>
<p>We send order confirmations and Shift Drop updates because you need them to get your order. We send news and launches only if you've opted in, or if you've bought from us in the last two years. Every marketing email or text includes our name, mailing address, and a way to unsubscribe. We act on unsubscribe requests within 10 business days, usually much sooner.</p>
<h2>6. How we protect it</h2>
<p>Our site uses HTTPS encryption, payments run through Stripe, and access to customer records is limited to the people who need it to fill orders. If a breach creates a real risk of significant harm to you, we will notify you and the Privacy Commissioner of Canada.</p>
<h2>7. How long we keep it</h2>
<p>We keep order and payment records for six years, as Canadian tax law requires. Marketing contact details are deleted when you unsubscribe, apart from a record that you opted out. We remove names and emails from survey answers after two years unless you're a customer.</p>
<h2>8. Your rights</h2>
<p>You can ask to see the information we hold about you, correct it, withdraw consent for marketing, or ask us to delete it. Email <a href="mailto:privacy@shiftshappn.com">privacy@shiftshappn.com</a> and we'll respond within 30 days. We'll delete anything we aren't legally required to keep.</p>
<p>If you're not satisfied with our answer, you can complain to the Office of the Privacy Commissioner of Canada.</p>
<h2>9. Changes to this policy</h2>
<p>We'll post any change here with a new effective date, and email customers about significant changes before they take effect.</p>
`,
  },
] as const;
