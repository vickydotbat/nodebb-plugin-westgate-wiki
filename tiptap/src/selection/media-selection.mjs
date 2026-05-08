import { getImageLayoutClassForNode, getImageSizeClassForNode } from "../shared/image-class-contract.mjs";

export function getActiveImageNodeName(editor) {
  if (editor.isActive("imageFigure")) {
    return "imageFigure";
  }
  if (editor.isActive("image")) {
    return "image";
  }
  return "";
}

export function findNodeSelectionPos(editor, domNode, typeNames) {
  if (!editor || !domNode) {
    return null;
  }

  const names = new Set(typeNames || []);
  const rootPos = editor.view.posAtDOM(domNode, 0);
  const clampedPos = Math.max(0, Math.min(rootPos, editor.state.doc.content.size));
  const directNode = editor.state.doc.nodeAt(clampedPos);
  if (directNode && names.has(directNode.type.name)) {
    return clampedPos;
  }

  const previousNode = clampedPos > 0 ? editor.state.doc.nodeAt(clampedPos - 1) : null;
  if (previousNode && names.has(previousNode.type.name)) {
    return clampedPos - 1;
  }

  const $pos = editor.state.doc.resolve(clampedPos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if (names.has($pos.node(depth).type.name)) {
      return $pos.before(depth);
    }
  }

  return null;
}

export function focusMediaCell(editor, cellElement) {
  if (!editor || !cellElement) {
    return false;
  }

  const rootPos = editor.view.posAtDOM(cellElement, 0);
  const clampedPos = Math.max(0, Math.min(rootPos, editor.state.doc.content.size));
  const $pos = editor.state.doc.resolve(clampedPos);

  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === "mediaCell") {
      return editor.chain().focus().setTextSelection($pos.start(depth)).run();
    }
  }

  return false;
}

export function setSelectedImageLayout(editor, layout) {
  const nodeName = getActiveImageNodeName(editor);
  if (!nodeName) {
    return false;
  }

  const nextClass = getImageLayoutClassForNode(nodeName, editor.getAttributes(nodeName).class || "", layout);
  return editor.chain().focus().updateAttributes(nodeName, { class: nextClass }).run();
}

export function isImageLayoutActive(editor, layout) {
  const nodeName = getActiveImageNodeName(editor);
  if (!nodeName) {
    return false;
  }

  const className = String(editor.getAttributes(nodeName).class || "");
  if (nodeName === "imageFigure") {
    return {
      center: className.includes("image-style-block"),
      left: className.includes("image-style-align-left"),
      right: className.includes("image-style-align-right"),
      side: className.includes("image-style-side")
    }[layout] || false;
  }

  return {
    center: className.includes("wiki-image-align-center"),
    left: className.includes("wiki-image-align-left"),
    right: className.includes("wiki-image-align-right"),
    side: className.includes("wiki-image-align-side")
  }[layout] || false;
}

export function setSelectedImageSize(editor, size) {
  const nodeName = getActiveImageNodeName(editor);
  if (!nodeName) {
    return false;
  }

  const nextClass = getImageSizeClassForNode(nodeName, editor.getAttributes(nodeName).class || "", size);
  return editor.chain().focus().updateAttributes(nodeName, { class: nextClass }).run();
}

export function isImageSizeActive(editor, size) {
  const nodeName = getActiveImageNodeName(editor);
  if (!nodeName) {
    return false;
  }

  const className = String(editor.getAttributes(nodeName).class || "");
  return {
    sm: className.includes("wiki-image-size-sm"),
    md: className.includes("wiki-image-size-md"),
    lg: className.includes("wiki-image-size-lg"),
    full: className.includes("wiki-image-size-full")
  }[size] || false;
}
