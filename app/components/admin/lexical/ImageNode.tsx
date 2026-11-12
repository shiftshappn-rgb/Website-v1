import { useCallback, useEffect, type JSX } from "react";
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  LexicalParseJSON,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import {
  $applyNodeReplacement,
  $createNodeSelection,
  $createParagraphNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isNodeSelection,
  $isRangeSelection,
  $setSelection,
  CLICK_COMMAND,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_DELETE_COMMAND,
  createCommand,
  type LexicalCommand,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useLexicalNodeSelection } from "@lexical/react/useLexicalNodeSelection";
import { mergeRegister } from "@lexical/utils";
import { cn } from "~/lib/utils";

export type SerializedImageNode = Spread<
  {
    src: string;
    altText: string;
  },
  SerializedLexicalNode
>;

export type InsertImagePayload = {
  src: string;
  altText?: string;
};

export const INSERT_IMAGE_COMMAND: LexicalCommand<InsertImagePayload> =
  createCommand("INSERT_IMAGE_COMMAND");

function convertImageElement(domNode: Node): DOMConversionOutput | null {
  if (!(domNode instanceof HTMLImageElement)) return null;
  const src = domNode.getAttribute("src");
  if (!src) return null;
  return {
    node: $createImageNode({
      src,
      altText: domNode.getAttribute("alt") ?? "",
    }),
  };
}

function ImageComponent({
  src,
  altText,
  nodeKey,
}: {
  src: string;
  altText: string;
  nodeKey: NodeKey;
}) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const onDelete = useCallback(
    (event: KeyboardEvent) => {
      if (!isSelected || !$isNodeSelection($getSelection())) {
        return false;
      }
      event.preventDefault();
      const node = $getNodeByKey(nodeKey);
      if ($isImageNode(node)) {
        node.remove();
      }
      return true;
    },
    [isSelected, nodeKey]
  );

  const onMove = useCallback(
    (event: KeyboardEvent, direction: "up" | "down") => {
      if (!isSelected || !$isNodeSelection($getSelection())) {
        return false;
      }
      const node = $getNodeByKey(nodeKey);
      if (!$isImageNode(node)) return false;
      const sibling =
        direction === "up" ? node.getPreviousSibling() : node.getNextSibling();
      if (!sibling) return false;
      event.preventDefault();
      if (direction === "up") {
        sibling.insertBefore(node);
      } else {
        sibling.insertAfter(node);
      }
      return true;
    },
    [isSelected, nodeKey]
  );

  useEffect(() => {
    return mergeRegister(
      editor.registerCommand(
        CLICK_COMMAND,
        (event: MouseEvent) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return false;
          if (!target.closest(`[data-lexical-image-key="${nodeKey}"]`)) {
            return false;
          }
          if (target.closest("[data-image-controls]")) {
            return false;
          }
          if (event.shiftKey) {
            setSelected(!isSelected);
          } else {
            clearSelection();
            setSelected(true);
          }
          return true;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(
        KEY_ARROW_UP_COMMAND,
        (event) => onMove(event, "up"),
        COMMAND_PRIORITY_LOW
      ),
      editor.registerCommand(
        KEY_ARROW_DOWN_COMMAND,
        (event) => onMove(event, "down"),
        COMMAND_PRIORITY_LOW
      )
    );
  }, [clearSelection, editor, isSelected, nodeKey, onDelete, onMove, setSelected]);

  function removeImage() {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isImageNode(node)) {
        node.remove();
      }
    });
  }

  function moveImage(direction: "up" | "down") {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (!$isImageNode(node)) return;
      const sibling =
        direction === "up" ? node.getPreviousSibling() : node.getNextSibling();
      if (!sibling) return;
      if (direction === "up") {
        sibling.insertBefore(node);
      } else {
        sibling.insertAfter(node);
      }
    });
  }

  return (
    <span
      data-lexical-image-key={nodeKey}
      className={cn(
        "relative my-3 inline-block max-w-full cursor-pointer rounded-lg outline-offset-2",
        isSelected && "outline outline-2 outline-navy"
      )}
      draggable={false}
    >
      <img
        src={src}
        alt={altText}
        draggable={false}
        className="max-h-80 max-w-full rounded-lg select-none"
      />
      {isSelected ? (
        <span data-image-controls className="absolute right-2 top-2 flex gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              moveImage("up");
            }}
            className="rounded-full bg-navy px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-charcoal"
          >
            Up
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              moveImage("down");
            }}
            className="rounded-full bg-navy px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-charcoal"
          >
            Down
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              removeImage();
            }}
            className="rounded-full bg-navy px-2.5 py-1 text-xs font-medium text-white shadow-sm hover:bg-charcoal"
          >
            Remove
          </button>
        </span>
      ) : null}
    </span>
  );
}

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;

  static getType(): string {
    return "image";
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__key);
  }

  constructor(src = "", altText = "", key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement("span");
    span.className = "lexical-image block";
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  isInline(): boolean {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  getSrc(): string {
    return this.getLatest().__src;
  }

  getAltText(): string {
    return this.getLatest().__altText;
  }

  setSrc(src: string): this {
    const writable = this.getWritable();
    writable.__src = src;
    return writable;
  }

  setAltText(altText: string): this {
    const writable = this.getWritable();
    writable.__altText = altText;
    return writable;
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement("img");
    img.setAttribute("src", this.__src);
    if (this.__altText) img.setAttribute("alt", this.__altText);
    return { element: img };
  }

  static importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: convertImageElement,
        priority: 0,
      }),
    };
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    return $createImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
    }).updateFromJSON(serializedNode as LexicalParseJSON<SerializedImageNode>);
  }

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: "image",
      src: this.__src,
      altText: this.__altText,
    };
  }

  decorate(): JSX.Element {
    return (
      <ImageComponent
        src={this.getSrc()}
        altText={this.getAltText()}
        nodeKey={this.getKey()}
      />
    );
  }
}

export function $createImageNode({
  src = "",
  altText = "",
}: {
  src?: string;
  altText?: string;
} = {}): ImageNode {
  return $applyNodeReplacement(new ImageNode(src, altText));
}

export function $isImageNode(
  node: LexicalNode | null | undefined
): node is ImageNode {
  return node instanceof ImageNode;
}

/** Registers INSERT_IMAGE_COMMAND. Renders no UI. */
export function ImagesPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      INSERT_IMAGE_COMMAND,
      ({ src, altText = "" }) => {
        const image = $createImageNode({ src, altText });
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertNodes([image]);
        } else {
          $getRoot().append(image);
        }
        if (!image.getNextSibling()) {
          image.insertAfter($createParagraphNode());
        }
        const nodeSelection = $createNodeSelection();
        nodeSelection.add(image.getKey());
        $setSelection(nodeSelection);
        return true;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  return null;
}
