import type { JSX } from "react";
import type {
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import { $applyNodeReplacement, DecoratorNode } from "lexical";

export type SerializedImageNode = Spread<
  {
    src: string;
    altText: string;
  },
  SerializedLexicalNode
>;

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

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;

  static getType() {
    return "image";
  }

  static clone(node: ImageNode) {
    return new ImageNode(node.__src, node.__altText, node.__key);
  }

  constructor(src: string, altText = "", key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
  }

  createDOM(_config: EditorConfig) {
    const span = document.createElement("span");
    span.className = "lexical-image";
    return span;
  }

  updateDOM() {
    return false;
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

  static importJSON(serializedNode: SerializedImageNode) {
    return $createImageNode({
      src: serializedNode.src,
      altText: serializedNode.altText,
    });
  }

  exportJSON(): SerializedImageNode {
    return {
      type: "image",
      version: 1,
      src: this.__src,
      altText: this.__altText,
    };
  }

  decorate() {
    return (
      // eslint-disable-next-line jsx-a11y/alt-text -- alt comes from node
      <img
        src={this.__src}
        alt={this.__altText}
        className="my-3 max-h-80 max-w-full rounded-lg"
      />
    );
  }
}

export function $createImageNode({
  src,
  altText = "",
}: {
  src: string;
  altText?: string;
}) {
  return $applyNodeReplacement(new ImageNode(src, altText));
}

export function $isImageNode(
  node: LexicalNode | null | undefined
): node is ImageNode {
  return node instanceof ImageNode;
}
