import "./wiki-editor.css";

import MarkdownIt from "markdown-it";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import CharacterCount from "@tiptap/extension-character-count";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import Underline from "@tiptap/extension-underline";

import ContainerBlock from "./extensions/container-block.mjs";
import ImageFigure from "./extensions/image-figure.mjs";
import { MediaCell, MediaRow } from "./extensions/media-row.mjs";
import PreservedNodeAttributes from "./extensions/preserved-node-attributes.mjs";
import SlashCommand from "./extensions/slash-command.mjs";
import StyledSpan from "./extensions/styled-span.mjs";
import WikiCallout from "./extensions/wiki-callout.mjs";
import {
  detectUnsupportedContent,
  getNormalizationNotice,
  normalizeLegacyHtmlForTiptap
} from "./normalization/legacy-html.mjs";
import {
  findNodeSelectionPos,
  focusMediaCell,
  getActiveImageNodeName,
  isImageLayoutActive,
  isImageSizeActive,
  setSelectedImageLayout,
  setSelectedImageSize
} from "./selection/media-selection.mjs";
import { sanitizeHtml } from "./shared/sanitizer-contract.mjs";
import { buildHeadingToc, flattenHeadingToc, navigateToHeading } from "./toolbar/editor-toc.mjs";
import { IMAGE_CONTEXT_BUTTON_IDS, TABLE_CONTEXT_BUTTON_IDS, TOP_TOOLBAR_BUTTON_IDS, TOP_TOOLBAR_GROUPS } from "./toolbar/toolbar-schema.mjs";

const markdownIt = new MarkdownIt({ html: true, linkify: true, typographer: true });

function createTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "*"
  });
  td.use(gfm);
  return td;
}

export { detectUnsupportedContent, getNormalizationNotice, normalizeLegacyHtmlForTiptap, sanitizeHtml };

export function htmlToMarkdown(html) {
  return createTurndown().turndown(html || "");
}

export function markdownToHtml(markdown) {
  return sanitizeHtml(markdownIt.render(markdown || ""));
}

const BUTTON_ICONS = {
  undo: "fa-undo",
  redo: "fa-repeat",
  paragraph: "fa-paragraph",
  "heading-1": "fa-header",
  "heading-2": "fa-header",
  "heading-3": "fa-header",
  "heading-4": "fa-header",
  bold: "fa-bold",
  italic: "fa-italic",
  underline: "fa-underline",
  strike: "fa-strikethrough",
  "inline-code": "fa-code",
  highlight: "fa-paint-brush",
  subscript: "fa-subscript",
  superscript: "fa-superscript",
  link: "fa-link",
  unlink: "fa-chain-broken",
  "image-upload": "fa-image",
  "media-row-2": "fa-columns",
  "media-row-3": "fa-th-large",
  "bullet-list": "fa-list-ul",
  "ordered-list": "fa-list-ol",
  "task-list": "fa-check-square-o",
  blockquote: "fa-quote-left",
  "code-block": "fa-file-code-o",
  "horizontal-rule": "fa-minus",
  "callout-info": "fa-info-circle",
  "callout-warning": "fa-exclamation-triangle",
  "callout-danger": "fa-ban",
  "align-left": "fa-align-left",
  "align-center": "fa-align-center",
  "align-right": "fa-align-right",
  "align-justify": "fa-align-justify",
  "table-insert": "fa-table",
  "table-add-row-before": "fa-plus",
  "table-add-row-after": "fa-plus",
  "table-delete-row": "fa-minus",
  "table-add-column-before": "fa-plus",
  "table-add-column-after": "fa-plus",
  "table-delete-column": "fa-minus",
  "table-merge-cells": "fa-compress",
  "table-split-cell": "fa-expand",
  "table-toggle-header-row": "fa-header",
  "table-toggle-header-column": "fa-header",
  "table-delete": "fa-trash",
  "image-align-center": "fa-align-center",
  "image-align-left": "fa-align-left",
  "image-align-right": "fa-align-right",
  "image-align-side": "fa-indent",
  "image-size-sm": "fa-compress",
  "image-size-md": "fa-arrows-h",
  "image-size-lg": "fa-expand",
  "image-size-full": "fa-arrows-alt"
};

function createButton(def) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-outline-secondary btn-sm wiki-editor-toolbar__button";
  button.setAttribute("title", def.title);
  button.setAttribute("aria-label", def.title);
  button.setAttribute("data-toolbar-id", def.id);

  const icon = document.createElement("i");
  icon.className = `fa ${BUTTON_ICONS[def.id] || "fa-circle"} wiki-editor-toolbar__icon`;
  icon.setAttribute("aria-hidden", "true");
  button.appendChild(icon);

  if (/^heading-[1-4]$/.test(def.id)) {
    const badge = document.createElement("span");
    badge.className = "wiki-editor-toolbar__icon-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = def.id.split("-")[1];
    button.appendChild(badge);
  }

  if (def.badge) {
    const badge = document.createElement("span");
    badge.className = "wiki-editor-toolbar__icon-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = def.badge;
    button.appendChild(badge);
  }

  button.addEventListener("click", function (event) {
    event.preventDefault();
    def.action();
  });
  return button;
}

function createToolbar(root, editor, uploadImage) {
  const toolbar = document.createElement("div");
  toolbar.className = "wiki-editor-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Wiki editor tools");

  const groups = [];
  const separators = [];

  function addGroup(defs, groupId) {
    const schemaGroup = TOP_TOOLBAR_GROUPS.find(function (groupDef) {
      return groupDef.id === groupId;
    });
    if (!schemaGroup) {
      throw new Error(`Unexpected top toolbar group: ${groupId || "(missing)"}`);
    }

    const group = document.createElement("div");
    group.className = "wiki-editor-toolbar__group";
    group.setAttribute("data-toolbar-group", schemaGroup.id);
    group.setAttribute("aria-label", schemaGroup.label);
    defs.forEach(function (def) {
      if (!TOP_TOOLBAR_BUTTON_IDS.includes(def.id)) {
        throw new Error(`Unknown top toolbar button: ${def.id}`);
      }
      if (!schemaGroup.buttonIds.includes(def.id)) {
        throw new Error(`Toolbar button ${def.id} is not part of group ${schemaGroup.id}`);
      }
      const button = createButton(def);
      def.applyState = def.applyState || function () {};
      def.button = button;
      group.appendChild(button);
    });
    if (groups.length > 0) {
      const separator = document.createElement("span");
      separator.className = "wiki-editor-toolbar__separator";
      separator.setAttribute("aria-hidden", "true");
      toolbar.appendChild(separator);
      separators.push(separator);
    }
    toolbar.appendChild(group);
    groups.push(defs);
  }

  addGroup([
    {
      id: "undo",
      title: "Undo",
      action: function () {
        editor.chain().focus().undo().run();
      },
      applyState: function (button) {
        button.disabled = !editor.can().chain().focus().undo().run();
      }
    },
    {
      id: "redo",
      title: "Redo",
      action: function () {
        editor.chain().focus().redo().run();
      },
      applyState: function (button) {
        button.disabled = !editor.can().chain().focus().redo().run();
      }
    }
  ], "history");

  addGroup([
    {
      id: "paragraph",
      title: "Paragraph",
      action: function () {
        editor.chain().focus().setParagraph().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("paragraph"));
      }
    },
    {
      id: "heading-1",
      title: "Heading 1",
      action: function () {
        editor.chain().focus().toggleHeading({ level: 1 }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("heading", { level: 1 }));
      }
    },
    {
      id: "heading-2",
      title: "Heading 2",
      action: function () {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("heading", { level: 2 }));
      }
    },
    {
      id: "heading-3",
      title: "Heading 3",
      action: function () {
        editor.chain().focus().toggleHeading({ level: 3 }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("heading", { level: 3 }));
      }
    },
    {
      id: "heading-4",
      title: "Heading 4",
      action: function () {
        editor.chain().focus().toggleHeading({ level: 4 }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("heading", { level: 4 }));
      }
    }
  ], "structure");

  addGroup([
    {
      id: "bold",
      title: "Bold",
      action: function () {
        editor.chain().focus().toggleBold().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("bold"));
      }
    },
    {
      id: "italic",
      title: "Italic",
      action: function () {
        editor.chain().focus().toggleItalic().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("italic"));
      }
    },
    {
      id: "underline",
      title: "Underline",
      action: function () {
        editor.chain().focus().toggleUnderline().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("underline"));
      }
    },
    {
      id: "strike",
      title: "Strike",
      action: function () {
        editor.chain().focus().toggleStrike().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("strike"));
      }
    },
    {
      id: "inline-code",
      title: "Inline code",
      action: function () {
        editor.chain().focus().toggleCode().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("code"));
      }
    },
    {
      id: "highlight",
      title: "Highlight",
      action: function () {
        editor.chain().focus().toggleHighlight().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("highlight"));
      }
    },
    {
      id: "subscript",
      title: "Subscript",
      action: function () {
        editor.chain().focus().toggleSubscript().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("subscript"));
      }
    },
    {
      id: "superscript",
      title: "Superscript",
      action: function () {
        editor.chain().focus().toggleSuperscript().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("superscript"));
      }
    }
  ], "inline-formatting");

  addGroup([
    {
      id: "link",
      title: "Set link",
      action: function () {
        const currentHref = editor.getAttributes("link").href || "";
        const href = window.prompt("Link URL", currentHref || "https://");
        if (!href) {
          return;
        }
        editor.chain().focus().extendMarkRange("link").setLink({
          href: href.trim(),
          target: "_blank",
          rel: "noopener noreferrer"
        }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("link"));
      }
    },
    {
      id: "unlink",
      title: "Remove link",
      action: function () {
        editor.chain().focus().unsetLink().run();
      },
      applyState: function (button) {
        button.disabled = !editor.isActive("link");
      }
    },
    {
      id: "image-upload",
      title: "Upload image",
      action: function () {
        uploadImage();
      }
    },
    {
      id: "media-row-2",
      title: "Insert two-column media row",
      badge: "2",
      action: function () {
        editor.chain().focus().insertMediaRow(2).run();
      }
    },
    {
      id: "media-row-3",
      title: "Insert three-column media row",
      badge: "3",
      action: function () {
        editor.chain().focus().insertMediaRow(3).run();
      }
    }
  ], "links-media");

  addGroup([
    {
      id: "bullet-list",
      title: "Bullet list",
      action: function () {
        editor.chain().focus().toggleBulletList().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("bulletList"));
      }
    },
    {
      id: "ordered-list",
      title: "Ordered list",
      action: function () {
        editor.chain().focus().toggleOrderedList().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("orderedList"));
      }
    },
    {
      id: "task-list",
      title: "Task list",
      action: function () {
        editor.chain().focus().toggleTaskList().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("taskList"));
      }
    },
    {
      id: "blockquote",
      title: "Blockquote",
      action: function () {
        editor.chain().focus().toggleBlockquote().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("blockquote"));
      }
    },
    {
      id: "code-block",
      title: "Code block",
      action: function () {
        editor.chain().focus().toggleCodeBlock().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("codeBlock"));
      }
    },
    {
      id: "horizontal-rule",
      title: "Horizontal rule",
      action: function () {
        editor.chain().focus().setHorizontalRule().run();
      }
    }
  ], "blocks");

  addGroup([
    {
      id: "callout-info",
      title: "Insert info callout",
      action: function () {
        editor.chain().focus().insertWikiCallout({ type: "info", title: "Info" }).run();
      }
    },
    {
      id: "callout-warning",
      title: "Insert warning callout",
      action: function () {
        editor.chain().focus().insertWikiCallout({ type: "warning", title: "Warning" }).run();
      }
    },
    {
      id: "callout-danger",
      title: "Insert danger callout",
      action: function () {
        editor.chain().focus().insertWikiCallout({ type: "danger", title: "Danger" }).run();
      }
    }
  ], "callouts");

  addGroup([
    {
      id: "align-left",
      title: "Align left",
      action: function () {
        editor.chain().focus().setTextAlign("left").run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive({ textAlign: "left" }));
      }
    },
    {
      id: "align-center",
      title: "Align center",
      action: function () {
        editor.chain().focus().setTextAlign("center").run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive({ textAlign: "center" }));
      }
    },
    {
      id: "align-right",
      title: "Align right",
      action: function () {
        editor.chain().focus().setTextAlign("right").run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive({ textAlign: "right" }));
      }
    },
    {
      id: "align-justify",
      title: "Justify",
      action: function () {
        editor.chain().focus().setTextAlign("justify").run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive({ textAlign: "justify" }));
      }
    }
  ], "alignment");

  addGroup([
    {
      id: "table-insert",
      title: "Insert table",
      action: function () {
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      }
    }
  ], "tables");

  function syncToolbar() {
    groups.forEach(function (defs) {
      defs.forEach(function (def) {
        def.button.disabled = false;
        def.button.classList.remove("active");
        def.applyState(def.button);
      });
    });
    syncToolbarSeparators();
  }

  function syncToolbarSeparators() {
    separators.forEach(function (separator) {
      const previousGroup = separator.previousElementSibling;
      const nextGroup = separator.nextElementSibling;
      const sameRow = previousGroup &&
        nextGroup &&
        previousGroup.offsetTop === separator.offsetTop &&
        separator.offsetTop === nextGroup.offsetTop;
      separator.hidden = !sameRow;
    });
  }

  editor.on("create", syncToolbar);
  editor.on("selectionUpdate", syncToolbar);
  editor.on("transaction", syncToolbar);
  editor.on("focus", syncToolbar);
  editor.on("blur", syncToolbar);
  window.addEventListener("resize", syncToolbarSeparators);
  syncToolbar();

  root.appendChild(toolbar);
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(syncToolbarSeparators);
  } else {
    setTimeout(syncToolbarSeparators, 0);
  }

  return {
    destroy: function () {
      window.removeEventListener("resize", syncToolbarSeparators);
    }
  };
}

function getImageToolDefs(editor) {
  return [
    {
      id: "image-align-center",
      title: "Center image",
      action: function () {
        setSelectedImageLayout(editor, "center");
      },
      applyState: function (button) {
        button.classList.toggle("active", isImageLayoutActive(editor, "center"));
      }
    },
    {
      id: "image-align-left",
      title: "Align image left",
      action: function () {
        setSelectedImageLayout(editor, "left");
      },
      applyState: function (button) {
        button.classList.toggle("active", isImageLayoutActive(editor, "left"));
      }
    },
    {
      id: "image-align-right",
      title: "Align image right",
      action: function () {
        setSelectedImageLayout(editor, "right");
      },
      applyState: function (button) {
        button.classList.toggle("active", isImageLayoutActive(editor, "right"));
      }
    },
    {
      id: "image-align-side",
      title: "Wrap text around image",
      action: function () {
        setSelectedImageLayout(editor, "side");
      },
      applyState: function (button) {
        button.classList.toggle("active", isImageLayoutActive(editor, "side"));
      }
    },
    {
      id: "image-size-sm",
      title: "Small image",
      action: function () {
        setSelectedImageSize(editor, "sm");
      },
      applyState: function (button) {
        button.classList.toggle("active", isImageSizeActive(editor, "sm"));
      }
    },
    {
      id: "image-size-md",
      title: "Medium image",
      action: function () {
        setSelectedImageSize(editor, "md");
      },
      applyState: function (button) {
        button.classList.toggle("active", isImageSizeActive(editor, "md"));
      }
    },
    {
      id: "image-size-lg",
      title: "Large image",
      action: function () {
        setSelectedImageSize(editor, "lg");
      },
      applyState: function (button) {
        button.classList.toggle("active", isImageSizeActive(editor, "lg"));
      }
    },
    {
      id: "image-size-full",
      title: "Full-width image",
      action: function () {
        setSelectedImageSize(editor, "full");
      },
      applyState: function (button) {
        button.classList.toggle("active", isImageSizeActive(editor, "full"));
      }
    }
  ];
}

function positionImageTools(editor, panel, surface) {
  const { selection } = editor.state;
  const selectedDom = editor.view.nodeDOM(selection.from);
  const imageEl = selectedDom && selectedDom.nodeType === 1
    ? (
      selectedDom.matches("img, figure.image")
        ? selectedDom
        : selectedDom.querySelector("img, figure.image")
    )
    : null;

  if (!imageEl || !surface.contains(imageEl)) {
    panel.style.left = "";
    panel.style.top = "";
    return;
  }

  const surfaceRect = surface.getBoundingClientRect();
  const imageRect = imageEl.getBoundingClientRect();
  const panelWidth = panel.offsetWidth || 256;
  const left = Math.max(8, Math.min(imageRect.left - surfaceRect.left, surfaceRect.width - panelWidth - 8));
  const top = Math.max(8, imageRect.top - surfaceRect.top - panel.offsetHeight - 8);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function createImageContextToolbar(surface, editor) {
  const panel = document.createElement("div");
  panel.className = "wiki-editor-image-tools";
  panel.setAttribute("role", "toolbar");
  panel.setAttribute("aria-label", "Selected image tools");
  panel.hidden = true;

  const defs = getImageToolDefs(editor);
  defs.forEach(function (def) {
    if (!IMAGE_CONTEXT_BUTTON_IDS.includes(def.id)) {
      throw new Error(`Unknown image context button: ${def.id}`);
    }
    def.button = createButton(def);
    panel.appendChild(def.button);
  });

  function syncImageTools() {
    const hasImage = !!getActiveImageNodeName(editor);
    panel.hidden = !hasImage;
    if (!hasImage) {
      return;
    }

    defs.forEach(function (def) {
      def.button.classList.remove("active");
      def.button.disabled = false;
      def.applyState(def.button);
    });
    positionImageTools(editor, panel, surface);
  }

  editor.on("create", syncImageTools);
  editor.on("selectionUpdate", syncImageTools);
  editor.on("transaction", syncImageTools);
  editor.on("focus", syncImageTools);
  editor.on("blur", syncImageTools);
  window.addEventListener("resize", syncImageTools);
  surface.appendChild(panel);
  syncImageTools();

  return {
    destroy: function () {
      window.removeEventListener("resize", syncImageTools);
      if (panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    }
  };
}

function getTableToolDefs(editor) {
  return [
    {
      id: "table-add-row-before",
      title: "Insert row before",
      badge: "R+",
      action: function () { editor.chain().focus().addRowBefore().run(); },
      applyState: function (button) { button.disabled = !editor.can().chain().focus().addRowBefore().run(); }
    },
    {
      id: "table-add-row-after",
      title: "Insert row after",
      badge: "+R",
      action: function () { editor.chain().focus().addRowAfter().run(); },
      applyState: function (button) { button.disabled = !editor.can().chain().focus().addRowAfter().run(); }
    },
    {
      id: "table-delete-row",
      title: "Delete current row",
      badge: "R",
      action: function () { editor.chain().focus().deleteRow().run(); },
      applyState: function (button) { button.disabled = !editor.can().chain().focus().deleteRow().run(); }
    },
    {
      id: "table-add-column-before",
      title: "Insert column before",
      badge: "C+",
      action: function () { editor.chain().focus().addColumnBefore().run(); },
      applyState: function (button) { button.disabled = !editor.can().chain().focus().addColumnBefore().run(); }
    },
    {
      id: "table-add-column-after",
      title: "Insert column after",
      badge: "+C",
      action: function () { editor.chain().focus().addColumnAfter().run(); },
      applyState: function (button) { button.disabled = !editor.can().chain().focus().addColumnAfter().run(); }
    },
    {
      id: "table-delete-column",
      title: "Delete current column",
      badge: "C",
      action: function () { editor.chain().focus().deleteColumn().run(); },
      applyState: function (button) { button.disabled = !editor.can().chain().focus().deleteColumn().run(); }
    },
    {
      id: "table-merge-cells",
      title: "Merge selected cells",
      action: function () { editor.chain().focus().mergeCells().run(); },
      applyState: function (button) { button.disabled = !editor.can().chain().focus().mergeCells().run(); }
    },
    {
      id: "table-split-cell",
      title: "Split selected cell",
      action: function () { editor.chain().focus().splitCell().run(); },
      applyState: function (button) { button.disabled = !editor.can().chain().focus().splitCell().run(); }
    },
    {
      id: "table-toggle-header-row",
      title: "Toggle header row",
      badge: "R",
      action: function () { editor.chain().focus().toggleHeaderRow().run(); },
      applyState: function (button) { button.disabled = !editor.can().chain().focus().toggleHeaderRow().run(); }
    },
    {
      id: "table-toggle-header-column",
      title: "Toggle header column",
      badge: "C",
      action: function () { editor.chain().focus().toggleHeaderColumn().run(); },
      applyState: function (button) { button.disabled = !editor.can().chain().focus().toggleHeaderColumn().run(); }
    },
    {
      id: "table-delete",
      title: "Delete table",
      action: function () { editor.chain().focus().deleteTable().run(); },
      applyState: function (button) { button.disabled = !editor.can().chain().focus().deleteTable().run(); }
    }
  ];
}

function getSelectionElement(editor) {
  const domAtPos = editor.view.domAtPos(editor.state.selection.from);
  const node = domAtPos && domAtPos.node;
  if (!node) {
    return null;
  }
  return node.nodeType === 1 ? node : node.parentElement;
}

function getActiveTableElement(editor, surface) {
  const selectionElement = getSelectionElement(editor);
  const table = selectionElement && typeof selectionElement.closest === "function" ? selectionElement.closest("table") : null;
  return table && surface.contains(table) ? table : null;
}

function positionContextPanel(panel, targetEl, surface) {
  const surfaceRect = surface.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const panelWidth = panel.offsetWidth || 320;
  const left = Math.max(8, Math.min(targetRect.left - surfaceRect.left, surfaceRect.width - panelWidth - 8));
  const top = Math.max(8, targetRect.top - surfaceRect.top - panel.offsetHeight - 8);
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
}

function createTableContextToolbar(surface, editor) {
  const panel = document.createElement("div");
  panel.className = "wiki-editor-context-tools wiki-editor-table-tools";
  panel.setAttribute("role", "toolbar");
  panel.setAttribute("aria-label", "Selected table tools");
  panel.hidden = true;

  const defs = getTableToolDefs(editor);
  defs.forEach(function (def) {
    if (!TABLE_CONTEXT_BUTTON_IDS.includes(def.id)) {
      throw new Error(`Unknown table context button: ${def.id}`);
    }
    def.button = createButton(def);
    panel.appendChild(def.button);
  });

  function syncTableTools() {
    const table = editor.isActive("table") ? getActiveTableElement(editor, surface) : null;
    panel.hidden = !table;
    if (!table) {
      return;
    }

    defs.forEach(function (def) {
      def.button.classList.remove("active");
      def.button.disabled = false;
      def.applyState(def.button);
    });
    positionContextPanel(panel, table, surface);
  }

  editor.on("create", syncTableTools);
  editor.on("selectionUpdate", syncTableTools);
  editor.on("transaction", syncTableTools);
  editor.on("focus", syncTableTools);
  editor.on("blur", syncTableTools);
  window.addEventListener("resize", syncTableTools);
  surface.appendChild(panel);
  syncTableTools();

  return {
    destroy: function () {
      window.removeEventListener("resize", syncTableTools);
      if (panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    }
  };
}

function createLinkContextToolbar(surface, editor) {
  const panel = document.createElement("div");
  panel.className = "wiki-editor-context-tools wiki-editor-link-tools";
  panel.setAttribute("role", "toolbar");
  panel.setAttribute("aria-label", "Selected link tools");
  panel.hidden = true;

  function editLink() {
    const currentHref = editor.getAttributes("link").href || "";
    const href = window.prompt("Link URL", currentHref || "https://");
    if (!href) {
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({
      href: href.trim(),
      target: "_blank",
      rel: "noopener noreferrer"
    }).run();
    panel.hidden = true;
  }

  function unlink() {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    panel.hidden = true;
  }

  [
    { id: "link", title: "Edit link", action: editLink },
    { id: "unlink", title: "Remove link", action: unlink }
  ].forEach(function (def) {
    panel.appendChild(createButton(def));
  });

  function showForLink(linkEl) {
    if (!linkEl || !surface.contains(linkEl)) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    positionContextPanel(panel, linkEl, surface);
  }

  function hideIfSelectionLeavesLink() {
    if (!editor.isActive("link")) {
      panel.hidden = true;
    }
  }

  editor.on("selectionUpdate", hideIfSelectionLeavesLink);
  editor.on("transaction", hideIfSelectionLeavesLink);
  window.addEventListener("resize", hideIfSelectionLeavesLink);
  surface.appendChild(panel);

  return {
    showForLink,
    destroy: function () {
      window.removeEventListener("resize", hideIfSelectionLeavesLink);
      if (panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
    }
  };
}

function createEditorToc(root, surface, editor) {
  const aside = document.createElement("aside");
  aside.className = "wiki-editor-toc";
  aside.setAttribute("aria-label", "Article table of contents");

  const title = document.createElement("div");
  title.className = "wiki-editor-toc__title";
  title.textContent = "Contents";
  aside.appendChild(title);

  const listMount = document.createElement("div");
  listMount.className = "wiki-editor-toc__list";
  aside.appendChild(listMount);

  function assignHeadingIds(items) {
    flattenHeadingToc(items).forEach(function (item) {
      const dom = editor.view.nodeDOM(item.pos);
      if (dom && dom.nodeType === 1) {
        dom.id = item.id;
      }
    });
  }

  function renderItems(items, parent) {
    const list = document.createElement("ol");
    list.className = "wiki-editor-toc__entries";
    parent.appendChild(list);

    items.forEach(function (item) {
      const row = document.createElement("li");
      row.className = `wiki-editor-toc__entry wiki-editor-toc__entry--level-${item.level}`;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "wiki-editor-toc__link";
      button.textContent = item.text;
      button.addEventListener("mousedown", function (event) {
        event.preventDefault();
      });
      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        navigateToHeading({ item, surface, editor });
      });
      row.appendChild(button);

      if (item.children && item.children.length) {
        renderItems(item.children, row);
      }
      list.appendChild(row);
    });
  }

  function syncToc() {
    const items = buildHeadingToc(editor);
    assignHeadingIds(items);
    listMount.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "wiki-editor-toc__empty";
      empty.textContent = "No headings";
      listMount.appendChild(empty);
      aside.classList.add("wiki-editor-toc--empty");
      return;
    }

    aside.classList.remove("wiki-editor-toc--empty");
    renderItems(items, listMount);
  }

  editor.on("create", syncToc);
  editor.on("update", syncToc);
  editor.on("transaction", syncToc);
  root.appendChild(aside);
  syncToc();

  return {
    destroy: function () {
      if (aside.parentNode) {
        aside.parentNode.removeChild(aside);
      }
    }
  };
}

async function uploadImageFile(relativePath, csrfToken, file) {
  const uploadUrl = `${relativePath || ""}/api/post/upload`;
  const formData = new FormData();
  formData.append("files[]", file);

  const response = await fetch(uploadUrl, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "x-csrf-token": csrfToken || ""
    },
    body: formData
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error((body && body.status && body.status.message) || response.statusText);
  }

  const image = (body.response && body.response.images && body.response.images[0]) || (body.images && body.images[0]);
  if (!image || !image.url) {
    throw new Error("Unexpected upload response");
  }

  return image.url;
}

export async function createWikiEditor(element, options) {
  const { relativePath, csrfToken, initialData = "" } = options || {};
  const onChange = options && typeof options.onChange === "function" ? options.onChange : function () {};
  const normalizedInitialData = normalizeLegacyHtmlForTiptap(initialData);
  let pendingUploads = 0;

  const root = document.createElement("div");
  root.className = "wiki-editor";

  const toolbarMount = document.createElement("div");
  toolbarMount.className = "wiki-editor__toolbar-mount";
  root.appendChild(toolbarMount);

  const body = document.createElement("div");
  body.className = "wiki-editor__body";
  root.appendChild(body);

  const editorMount = document.createElement("div");
  editorMount.className = "wiki-editor__surface wiki-article-prose";
  body.appendChild(editorMount);

  const metaRow = document.createElement("div");
  metaRow.className = "wiki-editor__meta small text-muted";
  root.appendChild(metaRow);

  const uploadInput = document.createElement("input");
  uploadInput.type = "file";
  uploadInput.accept = "image/*";
  uploadInput.className = "wiki-editor__upload-input";
  uploadInput.hidden = true;
  root.appendChild(uploadInput);

  element.innerHTML = "";
  element.appendChild(root);
  let linkContextToolbar = null;

  function setUploadStatus(text) {
    if (text) {
      metaRow.textContent = text;
      metaRow.classList.add("text-warning");
    } else {
      metaRow.classList.remove("text-warning");
      metaRow.textContent = `${editor.getText().trim().length.toLocaleString()} characters`;
    }
  }

  async function uploadFiles(files) {
    const imageFiles = Array.from(files || []).filter(function (file) {
      return file && /^image\//i.test(file.type || "");
    });
    if (imageFiles.length === 0) {
      return false;
    }

    pendingUploads += imageFiles.length;
    setUploadStatus(`Uploading ${pendingUploads.toLocaleString()} image${pendingUploads === 1 ? "" : "s"}…`);

    try {
      for (const file of imageFiles) {
        const url = await uploadImageFile(relativePath, csrfToken, file);
        editor.chain().focus().setImage({
          src: url,
          alt: file.name || ""
        }).run();
      }
    } catch (err) {
      const message = (err && err.message) || String(err);
      const paragraph = document.createElement("p");
      paragraph.className = "wiki-editor-upload-error";
      paragraph.textContent = `Image upload failed: ${message}`;
      editor.chain().focus().insertContent(paragraph.outerHTML).run();
    } finally {
      pendingUploads = Math.max(0, pendingUploads - imageFiles.length);
      setUploadStatus(pendingUploads ? `Uploading ${pendingUploads.toLocaleString()} image${pendingUploads === 1 ? "" : "s"}…` : "");
    }

    return true;
  }

  const editor = new Editor({
    element: editorMount,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4]
        }
      }),
      PreservedNodeAttributes,
      StyledSpan,
      ContainerBlock,
      MediaCell,
      MediaRow,
      ImageFigure,
      WikiCallout,
      Underline,
      Highlight,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https"
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          "data-wiki-node": "image"
        }
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Placeholder.configure({
        placeholder: "Write the article body…"
      }),
      CharacterCount,
      Typography,
      Subscript,
      Superscript,
      TextAlign.configure({
        types: ["heading", "paragraph"]
      }),
      SlashCommand.configure({
        requestImageUpload: function () {
          uploadInput.click();
        }
      })
    ],
    content: sanitizeHtml(normalizedInitialData),
    autofocus: false,
    editable: true,
    editorProps: {
      attributes: {
        class: "wiki-editor__content wiki-article-prose"
      },
      handleDOMEvents: {
        keydown: function (_view, event) {
          const isMod = event.metaKey || event.ctrlKey;
          if (!isMod || event.key.toLowerCase() !== "k") {
            return false;
          }

          event.preventDefault();
          if (event.shiftKey) {
            const wikiLinkSearch = document.getElementById("wiki-compose-link-search");
            if (wikiLinkSearch && typeof wikiLinkSearch.focus === "function") {
              wikiLinkSearch.focus();
            }
            return true;
          }

          const currentHref = editor.getAttributes("link").href || "";
          const href = window.prompt("Link URL", currentHref || "https://");
          if (href) {
            editor.chain().focus().extendMarkRange("link").setLink({
              href: href.trim(),
              target: "_blank",
              rel: "noopener noreferrer"
            }).run();
          }
          return true;
        },
        click: function (_view, event) {
          const target = event.target;
          const imageFigure = target && typeof target.closest === "function" ? target.closest('[data-wiki-node="image-figure"]') : null;
          const imageNode = target && typeof target.closest === "function" ? target.closest('img[data-wiki-node="image"]') : null;
          const mediaCell = target && typeof target.closest === "function" ? target.closest('[data-wiki-node="media-cell"]') : null;
          const link = target && typeof target.closest === "function" ? target.closest("a[href]") : null;
          if (link && editorMount.contains(link)) {
            event.preventDefault();
            event.stopPropagation();
            const posTarget = link.firstChild || link;
            const pos = editor.view.posAtDOM(posTarget, 0);
            editor.chain().focus().setTextSelection(pos).extendMarkRange("link").run();
            if (linkContextToolbar) {
              linkContextToolbar.showForLink(link);
            }
            return true;
          }

          if (target && target.tagName && target.tagName.toLowerCase() === "img") {
            const selectionPos = findNodeSelectionPos(editor, imageFigure || imageNode || target, ["imageFigure", "image"]);
            if (selectionPos != null) {
              event.preventDefault();
              event.stopPropagation();
              editor.chain().focus().setNodeSelection(selectionPos).run();
              return true;
            }
          }

          if (mediaCell && target === mediaCell) {
            event.preventDefault();
            event.stopPropagation();
            return focusMediaCell(editor, mediaCell);
          }

          return false;
        },
        paste: function (_view, event) {
          const files = event.clipboardData && event.clipboardData.files;
          if (!files || files.length === 0) {
            return false;
          }
          const handled = Array.from(files).some(function (file) {
            return /^image\//i.test(file.type || "");
          });
          if (!handled) {
            return false;
          }
          event.preventDefault();
          uploadFiles(files);
          return true;
        },
        drop: function (_view, event) {
          const files = event.dataTransfer && event.dataTransfer.files;
          if (!files || files.length === 0) {
            return false;
          }
          const handled = Array.from(files).some(function (file) {
            return /^image\//i.test(file.type || "");
          });
          if (!handled) {
            return false;
          }
          event.preventDefault();
          uploadFiles(files);
          return true;
        }
      }
    },
    onUpdate: function ({ editor: activeEditor }) {
      const plainTextLength = activeEditor.getText().trim().length;
      metaRow.textContent = `${plainTextLength.toLocaleString()} characters`;
      onChange();
    }
  });

  metaRow.textContent = `${editor.getText().trim().length.toLocaleString()} characters`;

  async function pickAndUploadImage() {
    uploadInput.value = "";
    uploadInput.click();
  }

  uploadInput.addEventListener("change", async function () {
    const file = uploadInput.files && uploadInput.files[0];
    if (!file) {
      return;
    }

    await uploadFiles([file]);
  });

  const topToolbar = createToolbar(toolbarMount, editor, pickAndUploadImage);
  const imageContextToolbar = createImageContextToolbar(editorMount, editor);
  const tableContextToolbar = createTableContextToolbar(editorMount, editor);
  linkContextToolbar = createLinkContextToolbar(editorMount, editor);
  const editorToc = createEditorToc(body, editorMount, editor);

  return {
    getHTML: function () {
      return sanitizeHtml(editor.getHTML());
    },
    getJSON: function () {
      return editor.getJSON();
    },
    getMarkdown: function () {
      return htmlToMarkdown(editor.getHTML());
    },
    hasPendingUploads: function () {
      return pendingUploads > 0;
    },
    setHTML: function (html) {
      editor.commands.setContent(sanitizeHtml(normalizeLegacyHtmlForTiptap(html)), false);
    },
    setMarkdown: function (markdown) {
      editor.commands.setContent(markdownToHtml(markdown), false);
    },
    insertWikiLink: function (insertText) {
      editor.chain().focus().insertContent(String(insertText || "")).run();
    },
    focus: function () {
      editor.commands.focus();
    },
    destroy: function () {
      topToolbar.destroy();
      imageContextToolbar.destroy();
      tableContextToolbar.destroy();
      linkContextToolbar.destroy();
      editorToc.destroy();
      return editor.destroy();
    }
  };
}

window.WestgateWikiEditor = {
  createWikiEditor,
  markdownToHtml,
  htmlToMarkdown,
  sanitizeHtml,
  detectUnsupportedContent,
  normalizeLegacyHtmlForTiptap,
  getNormalizationNotice
};
