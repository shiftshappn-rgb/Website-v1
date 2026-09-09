import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { useEffect } from "react";

export function RichTextEditor({
  name,
  defaultValue = "",
  label,
}: {
  name: string;
  defaultValue?: string;
  label?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
    ],
    content: defaultValue,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (editor && defaultValue && editor.isEmpty) {
      editor.commands.setContent(defaultValue);
    }
  }, [editor, defaultValue]);

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-charcoal">{label}</label>
      )}
      <div className="border border-charcoal/20 rounded-lg overflow-hidden bg-white">
        <div className="flex gap-1 p-2 border-b border-charcoal/10 bg-sand/50">
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBold().run()}
            active={editor?.isActive("bold")}
            label="Bold"
          >
            B
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            active={editor?.isActive("italic")}
            label="Italic"
          >
            I
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor?.isActive("heading", { level: 2 })}
            label="Heading"
          >
            H2
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            active={editor?.isActive("bulletList")}
            label="Bullet list"
          >
            •
          </ToolbarButton>
        </div>
        <EditorContent
          editor={editor}
          className="prose-brand p-4 min-h-[200px] focus-within:outline-none [&_.ProseMirror]:outline-none"
        />
      </div>
      <input
        type="hidden"
        name={name}
        value={editor?.getHTML() ?? defaultValue}
        readOnly
      />
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
      className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
        active
          ? "bg-navy text-white"
          : "text-charcoal hover:bg-charcoal/10"
      }`}
    >
      {children}
    </button>
  );
}
