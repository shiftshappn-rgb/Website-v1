import { useEffect, useMemo, useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL,
  FORMAT_TEXT_COMMAND,
  HISTORY_MERGE_TAG,
  KEY_MODIFIER_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type EditorState,
  type Klass,
  type LexicalNode,
} from "lexical";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import {
  $createHeadingNode,
  $createQuoteNode,
  $isHeadingNode,
  HeadingNode,
  QuoteNode,
  type HeadingTagType,
} from "@lexical/rich-text";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import {
  $isLinkNode,
  AutoLinkNode,
  LinkNode,
  TOGGLE_LINK_COMMAND,
  autoLinkEmailMatcher,
  autoLinkUrlMatcher,
} from "@lexical/link";
import {
  BOLD_STAR,
  BOLD_UNDERSCORE,
  HEADING,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  UNORDERED_LIST,
  type Transformer,
} from "@lexical/markdown";
import { $setBlocksType } from "@lexical/selection";
import { $findMatchingParent, $getNearestNodeOfType } from "@lexical/utils";
import {
  ImageNode,
  ImagesPlugin,
  INSERT_IMAGE_COMMAND,
} from "~/components/admin/lexical/ImageNode";
import {
  isProbablyHtml,
  isRichTextEmpty,
  isSafeRichTextUrl,
  plainTextToRichHtml,
} from "~/lib/rich-text";
import { cn } from "~/lib/utils";

const EDITOR_NAMESPACE_PREFIX = "rich-text";

const EDITOR_THEME = {
  paragraph: "mb-2",
  quote: "border-l-4 border-charcoal/20 pl-3 italic text-charcoal/80 my-2",
  heading: {
    h1: "text-2xl font-serif text-navy mt-3 mb-2",
    h2: "text-xl font-serif text-navy mt-3 mb-2",
    h3: "text-lg font-serif text-navy mt-2 mb-1",
    h4: "text-base font-serif text-navy mt-2 mb-1",
    h5: "text-sm font-serif text-navy mt-2 mb-1",
    h6: "text-sm font-serif text-navy mt-2 mb-1",
  },
  list: {
    ul: "list-disc pl-5 mb-2",
    ol: "list-decimal pl-5 mb-2",
    listitem: "mb-1",
  },
  link: "text-navy underline underline-offset-2",
  text: {
    bold: "font-semibold",
    italic: "italic",
    underline: "underline",
    strikethrough: "line-through",
  },
};

const EDITOR_NODES: Array<Klass<LexicalNode>> = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  ImageNode,
];

const MARKDOWN_TRANSFORMERS: Transformer[] = [
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  LINK,
];

const AUTO_LINK_MATCHERS = [autoLinkUrlMatcher, autoLinkEmailMatcher];

function onEditorError(error: Error) {
  console.error(error);
  throw error;
}

function InitialContentPlugin({ html }: { html: string }) {
  const [editor] = useLexicalComposerContext();
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const source = html.trim()
      ? isProbablyHtml(html)
        ? html
        : plainTextToRichHtml(html)
      : "";
    editor.update(
      () => {
        const root = $getRoot();
        root.clear();
        if (!source) {
          root.append($createParagraphNode());
          return;
        }
        const parser = new DOMParser();
        const dom = parser.parseFromString(source, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom);
        root.append(...nodes);
      },
      { tag: HISTORY_MERGE_TAG }
    );
    setDone(true);
  }, [done, editor, html]);

  return null;
}

function HtmlSyncPlugin({ onHtmlChange }: { onHtmlChange: (html: string) => void }) {
  const [editor] = useLexicalComposerContext();

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={(editorState: EditorState) => {
        editorState.read(() => {
          const html = $generateHtmlFromNodes(editor, null);
          onHtmlChange(isRichTextEmpty(html) ? "" : html);
        });
      }}
    />
  );
}

function LinkShortcutPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_MODIFIER_COMMAND,
      (event: KeyboardEvent) => {
        if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
          return false;
        }
        event.preventDefault();

        let hasLink = false;
        let hasRange = false;
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) return;
          hasRange = true;
          hasLink = Boolean(
            $findMatchingParent(selection.anchor.getNode(), $isLinkNode)
          );
        });
        if (!hasRange) return true;

        if (hasLink) {
          editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
          return true;
        }

        const url = window.prompt("Link URL", "https://");
        if (!url?.trim()) return true;
        if (!isSafeRichTextUrl(url.trim(), "href")) {
          window.alert("Use an http(s), mailto, or site-relative URL.");
          return true;
        }
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim());
        return true;
      },
      COMMAND_PRIORITY_NORMAL
    );
  }, [editor]);

  return null;
}

function ToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [formats, setFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    link: false,
    bullet: false,
    number: false,
    block: "paragraph" as string,
  });

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        let block = "paragraph";
        const anchor = selection.anchor.getNode();
        const element =
          anchor.getKey() === "root"
            ? anchor
            : $findMatchingParent(anchor, (node) => {
                const parent = node.getParent();
                return parent !== null && parent.getKey() === "root";
              }) ?? anchor.getTopLevelElementOrThrow();

        if ($isHeadingNode(element)) {
          block = element.getTag();
        } else if (element.getType() === "quote") {
          block = "quote";
        }

        const listParent = $getNearestNodeOfType(anchor, ListNode);
        setFormats({
          bold: selection.hasFormat("bold"),
          italic: selection.hasFormat("italic"),
          underline: selection.hasFormat("underline"),
          strikethrough: selection.hasFormat("strikethrough"),
          link: Boolean($findMatchingParent(anchor, $isLinkNode)),
          bullet: Boolean(listParent && listParent.getListType() === "bullet"),
          number: Boolean(listParent && listParent.getListType() === "number"),
          block,
        });
      });
    });
  }, [editor]);

  function setHeading(tag: HeadingTagType | "paragraph" | "quote") {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      if (tag === "paragraph") {
        $setBlocksType(selection, () => $createParagraphNode());
      } else if (tag === "quote") {
        $setBlocksType(selection, () => $createQuoteNode());
      } else {
        $setBlocksType(selection, () => $createHeadingNode(tag));
      }
    });
  }

  function toggleLink() {
    let hasRange = false;
    editor.getEditorState().read(() => {
      hasRange = $isRangeSelection($getSelection());
    });
    if (!hasRange) return;

    if (formats.link) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }
    const url = window.prompt("Link URL", "https://");
    if (!url?.trim()) return;
    if (!isSafeRichTextUrl(url.trim(), "href")) {
      window.alert("Use an http(s), mailto, or site-relative URL.");
      return;
    }
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim());
  }

  function insertImage() {
    const src = window.prompt("Image URL", "https://");
    if (!src?.trim()) return;
    if (!isSafeRichTextUrl(src.trim(), "src")) {
      window.alert("Use an http(s), site-relative, or data:image URL.");
      return;
    }
    const altText = window.prompt("Alt text (optional)", "") ?? "";
    editor.dispatchCommand(INSERT_IMAGE_COMMAND, {
      src: src.trim(),
      altText,
    });
  }

  function clearFormatting() {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      selection.getNodes().forEach((node) => {
        if ("setFormat" in node && typeof node.setFormat === "function") {
          node.setFormat(0);
        }
      });
      $setBlocksType(selection, () => $createParagraphNode());
    });
    editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
  }

  return (
    <div className="flex flex-wrap gap-1 border-b border-charcoal/10 bg-sand/50 p-2">
      <ToolbarButton
        label="Bold"
        active={formats.bold}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={formats.italic}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")}
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={formats.underline}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")}
      >
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={formats.strikethrough}
        onClick={() =>
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")
        }
      >
        <span className="line-through">S</span>
      </ToolbarButton>
      <span className="mx-1 w-px self-stretch bg-charcoal/15" />
      <ToolbarButton
        label="Paragraph"
        active={formats.block === "paragraph"}
        onClick={() => setHeading("paragraph")}
      >
        P
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={formats.block === "h2"}
        onClick={() => setHeading("h2")}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={formats.block === "h3"}
        onClick={() => setHeading("h3")}
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={formats.block === "quote"}
        onClick={() => setHeading("quote")}
      >
        “
      </ToolbarButton>
      <span className="mx-1 w-px self-stretch bg-charcoal/15" />
      <ToolbarButton
        label="Bullet list"
        active={formats.bullet}
        onClick={() =>
          editor.dispatchCommand(
            formats.bullet ? REMOVE_LIST_COMMAND : INSERT_UNORDERED_LIST_COMMAND,
            undefined
          )
        }
      >
        •
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={formats.number}
        onClick={() =>
          editor.dispatchCommand(
            formats.number ? REMOVE_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND,
            undefined
          )
        }
      >
        1.
      </ToolbarButton>
      <span className="mx-1 w-px self-stretch bg-charcoal/15" />
      <ToolbarButton label="Link (⌘K)" active={formats.link} onClick={toggleLink}>
        Link
      </ToolbarButton>
      <ToolbarButton label="Image" onClick={insertImage}>
        Img
      </ToolbarButton>
      <span className="mx-1 w-px self-stretch bg-charcoal/15" />
      <ToolbarButton
        label="Undo"
        onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
      >
        ↶
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
      >
        ↷
      </ToolbarButton>
      <ToolbarButton label="Clear formatting" onClick={clearFormatting}>
        Clear
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "min-h-8 min-w-8 rounded px-2 py-1 text-xs font-medium transition-colors",
        active ? "bg-navy text-white" : "text-charcoal hover:bg-charcoal/10"
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  name,
  defaultValue = "",
  label,
  required,
  minHeightClassName = "min-h-[200px]",
}: {
  name: string;
  defaultValue?: string;
  label?: string;
  required?: boolean;
  minHeightClassName?: string;
}) {
  const [html, setHtml] = useState(defaultValue);
  const initialConfig = useMemo(
    () => ({
      namespace: `${EDITOR_NAMESPACE_PREFIX}-${name}`,
      theme: EDITOR_THEME,
      editable: true,
      onError: onEditorError,
      nodes: EDITOR_NODES,
    }),
    [name]
  );

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-charcoal">
          {label}
          {required ? <span className="text-red-600"> *</span> : null}
        </label>
      )}
      <div className="overflow-hidden rounded-lg border border-charcoal/20 bg-white">
        <LexicalComposer initialConfig={initialConfig}>
          <ToolbarPlugin />
          <div className="relative">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className={cn(
                    "prose-brand px-4 py-3 outline-none focus:outline-none",
                    minHeightClassName
                  )}
                  aria-label={label ?? "Rich text"}
                />
              }
              placeholder={
                <div className="pointer-events-none absolute left-4 top-3 text-sm text-charcoal/40">
                  Write here… Use Markdown shortcuts like #, -, or **bold**.
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
          <HistoryPlugin />
          <ListPlugin />
          <LinkPlugin
            validateUrl={(url) => isSafeRichTextUrl(url, "href")}
            attributes={{ target: "_blank", rel: "noopener noreferrer" }}
          />
          <AutoLinkPlugin matchers={AUTO_LINK_MATCHERS} />
          <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
          <ImagesPlugin />
          <LinkShortcutPlugin />
          <InitialContentPlugin html={defaultValue} />
          <HtmlSyncPlugin onHtmlChange={setHtml} />
        </LexicalComposer>
      </div>
      <input type="hidden" name={name} value={html} required={required} readOnly />
    </div>
  );
}
