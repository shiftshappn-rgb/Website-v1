import { richTextToDisplayHtml } from "~/lib/rich-text";
import { cn } from "~/lib/utils";

export function RichTextHtml({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const safe = richTextToDisplayHtml(html);
  if (!safe) return null;

  return (
    <div
      className={cn("prose-brand", className)}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
