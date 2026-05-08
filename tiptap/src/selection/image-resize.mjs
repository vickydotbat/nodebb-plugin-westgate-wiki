import { getActiveImageNodeName } from "./media-selection.mjs";
import { removeImageSizeClasses } from "../shared/image-class-contract.mjs";

const DEFAULT_MIN_IMAGE_WIDTH = 96;

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function calculateResizedImageWidth(options) {
  const startWidth = toFiniteNumber(options && options.startWidth, DEFAULT_MIN_IMAGE_WIDTH);
  const deltaX = toFiniteNumber(options && options.deltaX, 0);
  const directionX = toFiniteNumber(options && options.directionX, 1) < 0 ? -1 : 1;
  const minWidth = toFiniteNumber(options && options.minWidth, DEFAULT_MIN_IMAGE_WIDTH);
  const maxWidth = toFiniteNumber(options && options.maxWidth, startWidth);
  return Math.round(clamp(startWidth + (deltaX * directionX), minWidth, Math.max(minWidth, maxWidth)));
}

export function setSelectedImageWidth(editor, width) {
  const nodeName = getActiveImageNodeName(editor);
  if (!nodeName) {
    return false;
  }

  const roundedWidth = Math.round(toFiniteNumber(width, 0));
  if (roundedWidth <= 0) {
    return false;
  }

  const currentClass = editor.getAttributes(nodeName).class || "";
  const nextClass = removeImageSizeClasses(currentClass);
  const attrs = {
    width: String(roundedWidth),
    height: null,
    class: nextClass || null
  };

  if (nodeName === "imageFigure" && !attrs.class) {
    attrs.class = "image";
  }

  return editor.chain().focus().updateAttributes(nodeName, attrs).run();
}

export function getSelectedImageElement(editor, surface) {
  if (!editor || !surface) {
    return null;
  }

  const selectedDom = editor.view.nodeDOM(editor.state.selection.from);
  const selectedElement = selectedDom && selectedDom.nodeType === 1 ? selectedDom : null;
  const imageElement = selectedElement
    ? (
      selectedElement.matches("figure.image")
        ? selectedElement.querySelector("img")
        : selectedElement.matches("img")
          ? selectedElement
          : selectedElement.querySelector("img")
    )
    : null;

  return imageElement && surface.contains(imageElement) ? imageElement : null;
}

function getSelectedImageFrameElement(editor, surface) {
  if (!editor || !surface) {
    return null;
  }

  const selectedDom = editor.view.nodeDOM(editor.state.selection.from);
  const selectedElement = selectedDom && selectedDom.nodeType === 1 ? selectedDom : null;
  const frame = selectedElement
    ? (
      selectedElement.matches("figure.image")
        ? selectedElement
        : selectedElement.matches("img")
          ? selectedElement
          : selectedElement.querySelector("figure.image, img")
    )
    : null;

  return frame && surface.contains(frame) ? frame : null;
}

function getImageResizeMaxWidth(imageElement, surface) {
  const container = imageElement.closest('[data-wiki-node="media-cell"], .wiki-editor__content') || surface;
  const rect = container.getBoundingClientRect();
  return Math.max(DEFAULT_MIN_IMAGE_WIDTH, Math.floor(rect.width || imageElement.getBoundingClientRect().width || DEFAULT_MIN_IMAGE_WIDTH));
}

function positionResizeOverlay(overlay, editor, surface) {
  const frame = getSelectedImageFrameElement(editor, surface);
  if (!frame || !getActiveImageNodeName(editor)) {
    overlay.hidden = true;
    return;
  }

  const surfaceRect = surface.getBoundingClientRect();
  const frameRect = frame.getBoundingClientRect();
  overlay.hidden = false;
  overlay.style.left = `${Math.round(frameRect.left - surfaceRect.left + surface.scrollLeft)}px`;
  overlay.style.top = `${Math.round(frameRect.top - surfaceRect.top + surface.scrollTop)}px`;
  overlay.style.width = `${Math.round(frameRect.width)}px`;
  overlay.style.height = `${Math.round(frameRect.height)}px`;
}

export function createImageResizeOverlay(surface, editor) {
  const overlay = document.createElement("div");
  overlay.className = "wiki-editor-image-resize";
  overlay.setAttribute("aria-hidden", "true");
  overlay.hidden = true;

  [
    ["nw", -1],
    ["ne", 1],
    ["sw", -1],
    ["se", 1]
  ].forEach(function ([corner, directionX]) {
    const handle = document.createElement("span");
    handle.className = `wiki-editor-image-resize__handle wiki-editor-image-resize__handle--${corner}`;
    handle.setAttribute("data-resize-direction-x", String(directionX));
    overlay.appendChild(handle);
  });

  let activeDrag = null;

  function sync() {
    if (!activeDrag) {
      positionResizeOverlay(overlay, editor, surface);
    }
  }

  function stopDrag(event) {
    if (!activeDrag) {
      return;
    }
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    setSelectedImageWidth(editor, activeDrag.currentWidth);
    activeDrag = null;
    document.body.classList.remove("wiki-editor--resizing-image");
    document.removeEventListener("pointermove", moveDrag);
    document.removeEventListener("pointerup", stopDrag);
    document.removeEventListener("pointercancel", stopDrag);
    sync();
  }

  function moveDrag(event) {
    if (!activeDrag) {
      return;
    }
    event.preventDefault();
    activeDrag.currentWidth = calculateResizedImageWidth({
      startWidth: activeDrag.startWidth,
      deltaX: event.clientX - activeDrag.startX,
      directionX: activeDrag.directionX,
      minWidth: DEFAULT_MIN_IMAGE_WIDTH,
      maxWidth: activeDrag.maxWidth
    });
    overlay.style.width = `${activeDrag.currentWidth}px`;
  }

  function startDrag(event) {
    const handle = event.target && event.target.closest ? event.target.closest("[data-resize-direction-x]") : null;
    if (!handle || !overlay.contains(handle)) {
      return;
    }

    const imageElement = getSelectedImageElement(editor, surface);
    if (!imageElement) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const imageRect = imageElement.getBoundingClientRect();
    activeDrag = {
      startX: event.clientX,
      startWidth: Math.round(imageRect.width || imageElement.width || DEFAULT_MIN_IMAGE_WIDTH),
      currentWidth: Math.round(imageRect.width || imageElement.width || DEFAULT_MIN_IMAGE_WIDTH),
      maxWidth: getImageResizeMaxWidth(imageElement, surface),
      directionX: Number(handle.getAttribute("data-resize-direction-x")) < 0 ? -1 : 1
    };
    document.body.classList.add("wiki-editor--resizing-image");
    document.addEventListener("pointermove", moveDrag);
    document.addEventListener("pointerup", stopDrag);
    document.addEventListener("pointercancel", stopDrag);
  }

  overlay.addEventListener("pointerdown", startDrag);
  editor.on("create", sync);
  editor.on("selectionUpdate", sync);
  editor.on("transaction", sync);
  editor.on("focus", sync);
  editor.on("blur", sync);
  window.addEventListener("resize", sync);
  surface.appendChild(overlay);
  sync();

  return {
    destroy: function () {
      if (activeDrag) {
        stopDrag();
      }
      window.removeEventListener("resize", sync);
      overlay.removeEventListener("pointerdown", startDrag);
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    },
    sync
  };
}
