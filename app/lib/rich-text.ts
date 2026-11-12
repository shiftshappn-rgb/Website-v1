import { parse, type HTMLElement, type Node as HtmlNode } from "node-html-parser";

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
  "h2",
  "h3",
  "blockquote",
  "img",
  "span",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt"]),
};

export function isProbablyHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value.trim());
}

/** True when HTML has no meaningful text/images (e.g. empty `<p><br></p>`). */
export function isRichTextEmpty(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/<img\b/i.test(trimmed)) return false;
  return richTextToPlainText(trimmed).length === 0;
}

/** Safe http(s)/mailto/relative URLs for editor link + image prompts. */
export function isSafeRichTextUrl(value: string, kind: "href" | "src"): boolean {
  return isSafeUrl(value, kind);
}

function isSafeUrl(value: string | undefined, kind: "href" | "src"): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (kind === "href") {
    return /^(https?:|mailto:|\/|#)/i.test(trimmed) && !/^javascript:/i.test(trimmed);
  }
  return /^(https?:|\/|data:image\/)/i.test(trimmed) && !/^javascript:/i.test(trimmed);
}

function sanitizeNode(node: HtmlNode) {
  if (node.nodeType === 3) return; // text
  if (!("tagName" in node) || !node.tagName) return;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  // Sanitize children first so unwrap preserves cleaned content.
  for (const child of [...el.childNodes]) {
    sanitizeNode(child);
  }

  if (!ALLOWED_TAGS.has(tag)) {
    el.replaceWith(...el.childNodes);
    return;
  }

  const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
  for (const [name, value] of Object.entries(el.attributes)) {
    const attr = name.toLowerCase();
    if (attr.startsWith("on") || !allowed.has(attr)) {
      el.removeAttribute(name);
      continue;
    }
    if (attr === "href" && !isSafeUrl(value, "href")) {
      el.removeAttribute(name);
      continue;
    }
    if (attr === "src" && !isSafeUrl(value, "src")) {
      el.removeAttribute(name);
    }
  }

  if (tag === "a") {
    const href = el.getAttribute("href");
    if (href?.startsWith("http")) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }
  }
}

/** Strip unsafe tags/attrs; keep blog/product formatting tags. */
export function sanitizeRichTextHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const root = parse(`<div id="__rt_root">${trimmed}</div>`, {
    comment: false,
  });
  const wrapper = root.querySelector("#__rt_root");
  if (!wrapper) return "";

  for (const child of [...wrapper.childNodes]) {
    sanitizeNode(child);
  }

  return wrapper.innerHTML.trim();
}

/** Convert legacy plain text (newlines / bullets) into simple HTML. */
export function plainTextToRichHtml(value: string): string {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return "";

  const bulletLines = lines.filter((line) => /^[-•*]\s+/.test(line));
  if (bulletLines.length === lines.length) {
    const items = lines
      .map((line) => `<li>${escapeHtml(line.replace(/^[-•*]\s+/, ""))}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }

  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

export function normalizeRichTextForStorage(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!isProbablyHtml(trimmed)) {
    return sanitizeRichTextHtml(plainTextToRichHtml(trimmed));
  }
  return sanitizeRichTextHtml(trimmed);
}

export function richTextToDisplayHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!isProbablyHtml(trimmed)) {
    return sanitizeRichTextHtml(plainTextToRichHtml(trimmed));
  }
  return sanitizeRichTextHtml(trimmed);
}

/** Plain text for meta tags / previews. */
export function richTextToPlainText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!isProbablyHtml(trimmed)) return trimmed.replace(/\s+/g, " ").trim();
  const root = parse(`<div id="__rt_plain">${trimmed}</div>`, { comment: false });
  const text = root.querySelector("#__rt_plain")?.text ?? "";
  return text.replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
