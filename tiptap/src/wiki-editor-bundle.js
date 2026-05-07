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
import StyledSpan from "./extensions/styled-span.mjs";
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

function createButton(label, title, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn-outline-secondary btn-sm wiki-editor-toolbar__button";
  button.textContent = label;
  button.setAttribute("title", title);
  button.addEventListener("click", function (event) {
    event.preventDefault();
    action();
  });
  return button;
}

function createToolbar(root, editor, uploadImage) {
  const toolbar = document.createElement("div");
  toolbar.className = "wiki-editor-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "Wiki editor tools");

  const groups = [];

  function addGroup(defs) {
    const group = document.createElement("div");
    group.className = "wiki-editor-toolbar__group";
    defs.forEach(function (def) {
      const button = createButton(def.label, def.title, def.action);
      def.applyState = def.applyState || function () {};
      def.button = button;
      group.appendChild(button);
    });
    toolbar.appendChild(group);
    groups.push(defs);
  }

  addGroup([
    {
      label: "Undo",
      title: "Undo",
      action: function () {
        editor.chain().focus().undo().run();
      },
      applyState: function (button) {
        button.disabled = !editor.can().chain().focus().undo().run();
      }
    },
    {
      label: "Redo",
      title: "Redo",
      action: function () {
        editor.chain().focus().redo().run();
      },
      applyState: function (button) {
        button.disabled = !editor.can().chain().focus().redo().run();
      }
    }
  ]);

  addGroup([
    {
      label: "P",
      title: "Paragraph",
      action: function () {
        editor.chain().focus().setParagraph().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("paragraph"));
      }
    },
    {
      label: "H1",
      title: "Heading 1",
      action: function () {
        editor.chain().focus().toggleHeading({ level: 1 }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("heading", { level: 1 }));
      }
    },
    {
      label: "H2",
      title: "Heading 2",
      action: function () {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("heading", { level: 2 }));
      }
    },
    {
      label: "H3",
      title: "Heading 3",
      action: function () {
        editor.chain().focus().toggleHeading({ level: 3 }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("heading", { level: 3 }));
      }
    },
    {
      label: "H4",
      title: "Heading 4",
      action: function () {
        editor.chain().focus().toggleHeading({ level: 4 }).run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("heading", { level: 4 }));
      }
    }
  ]);

  addGroup([
    {
      label: "B",
      title: "Bold",
      action: function () {
        editor.chain().focus().toggleBold().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("bold"));
      }
    },
    {
      label: "I",
      title: "Italic",
      action: function () {
        editor.chain().focus().toggleItalic().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("italic"));
      }
    },
    {
      label: "U",
      title: "Underline",
      action: function () {
        editor.chain().focus().toggleUnderline().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("underline"));
      }
    },
    {
      label: "S",
      title: "Strike",
      action: function () {
        editor.chain().focus().toggleStrike().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("strike"));
      }
    },
    {
      label: "Code",
      title: "Inline code",
      action: function () {
        editor.chain().focus().toggleCode().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("code"));
      }
    },
    {
      label: "Mark",
      title: "Highlight",
      action: function () {
        editor.chain().focus().toggleHighlight().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("highlight"));
      }
    },
    {
      label: "Sub",
      title: "Subscript",
      action: function () {
        editor.chain().focus().toggleSubscript().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("subscript"));
      }
    },
    {
      label: "Sup",
      title: "Superscript",
      action: function () {
        editor.chain().focus().toggleSuperscript().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("superscript"));
      }
    }
  ]);

  addGroup([
    {
      label: "Link",
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
      label: "Unlink",
      title: "Remove link",
      action: function () {
        editor.chain().focus().unsetLink().run();
      },
      applyState: function (button) {
        button.disabled = !editor.isActive("link");
      }
    },
    {
      label: "Image",
      title: "Upload image",
      action: function () {
        uploadImage();
      }
    }
  ]);

  addGroup([
    {
      label: "Img C",
      title: "Center image",
      action: function () {
        setSelectedImageLayout(editor, "center");
      },
      applyState: function (button) {
        button.disabled = !getActiveImageNodeName(editor);
        button.classList.toggle("active", isImageLayoutActive(editor, "center"));
      }
    },
    {
      label: "Img L",
      title: "Align image left",
      action: function () {
        setSelectedImageLayout(editor, "left");
      },
      applyState: function (button) {
        button.disabled = !getActiveImageNodeName(editor);
        button.classList.toggle("active", isImageLayoutActive(editor, "left"));
      }
    },
    {
      label: "Img R",
      title: "Align image right",
      action: function () {
        setSelectedImageLayout(editor, "right");
      },
      applyState: function (button) {
        button.disabled = !getActiveImageNodeName(editor);
        button.classList.toggle("active", isImageLayoutActive(editor, "right"));
      }
    },
    {
      label: "Img Side",
      title: "Wrap text around image",
      action: function () {
        setSelectedImageLayout(editor, "side");
      },
      applyState: function (button) {
        button.disabled = !getActiveImageNodeName(editor);
        button.classList.toggle("active", isImageLayoutActive(editor, "side"));
      }
    }
  ]);

  addGroup([
    {
      label: "Img S",
      title: "Small image size",
      action: function () {
        setSelectedImageSize(editor, "sm");
      },
      applyState: function (button) {
        button.disabled = !getActiveImageNodeName(editor);
        button.classList.toggle("active", isImageSizeActive(editor, "sm"));
      }
    },
    {
      label: "Img M",
      title: "Medium image size",
      action: function () {
        setSelectedImageSize(editor, "md");
      },
      applyState: function (button) {
        button.disabled = !getActiveImageNodeName(editor);
        button.classList.toggle("active", isImageSizeActive(editor, "md"));
      }
    },
    {
      label: "Img L",
      title: "Large image size",
      action: function () {
        setSelectedImageSize(editor, "lg");
      },
      applyState: function (button) {
        button.disabled = !getActiveImageNodeName(editor);
        button.classList.toggle("active", isImageSizeActive(editor, "lg"));
      }
    },
    {
      label: "Img Full",
      title: "Full-width image size",
      action: function () {
        setSelectedImageSize(editor, "full");
      },
      applyState: function (button) {
        button.disabled = !getActiveImageNodeName(editor);
        button.classList.toggle("active", isImageSizeActive(editor, "full"));
      }
    }
  ]);

  addGroup([
    {
      label: "2-Up",
      title: "Insert two-column media row",
      action: function () {
        editor.chain().focus().insertMediaRow(2).run();
      }
    },
    {
      label: "3-Up",
      title: "Insert three-column media row",
      action: function () {
        editor.chain().focus().insertMediaRow(3).run();
      }
    }
  ]);

  addGroup([
    {
      label: "Bullets",
      title: "Bullet list",
      action: function () {
        editor.chain().focus().toggleBulletList().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("bulletList"));
      }
    },
    {
      label: "Numbers",
      title: "Ordered list",
      action: function () {
        editor.chain().focus().toggleOrderedList().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("orderedList"));
      }
    },
    {
      label: "Tasks",
      title: "Task list",
      action: function () {
        editor.chain().focus().toggleTaskList().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("taskList"));
      }
    },
    {
      label: "Quote",
      title: "Blockquote",
      action: function () {
        editor.chain().focus().toggleBlockquote().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("blockquote"));
      }
    },
    {
      label: "Code Block",
      title: "Code block",
      action: function () {
        editor.chain().focus().toggleCodeBlock().run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive("codeBlock"));
      }
    },
    {
      label: "Rule",
      title: "Horizontal rule",
      action: function () {
        editor.chain().focus().setHorizontalRule().run();
      }
    }
  ]);

  addGroup([
    {
      label: "Left",
      title: "Align left",
      action: function () {
        editor.chain().focus().setTextAlign("left").run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive({ textAlign: "left" }));
      }
    },
    {
      label: "Center",
      title: "Align center",
      action: function () {
        editor.chain().focus().setTextAlign("center").run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive({ textAlign: "center" }));
      }
    },
    {
      label: "Right",
      title: "Align right",
      action: function () {
        editor.chain().focus().setTextAlign("right").run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive({ textAlign: "right" }));
      }
    },
    {
      label: "Justify",
      title: "Justify",
      action: function () {
        editor.chain().focus().setTextAlign("justify").run();
      },
      applyState: function (button) {
        button.classList.toggle("active", editor.isActive({ textAlign: "justify" }));
      }
    }
  ]);

  addGroup([
    {
      label: "Table",
      title: "Insert table",
      action: function () {
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      }
    },
    {
      label: "+Row",
      title: "Add row after",
      action: function () {
        editor.chain().focus().addRowAfter().run();
      },
      applyState: function (button) {
        button.disabled = !editor.can().chain().focus().addRowAfter().run();
      }
    },
    {
      label: "+Col",
      title: "Add column after",
      action: function () {
        editor.chain().focus().addColumnAfter().run();
      },
      applyState: function (button) {
        button.disabled = !editor.can().chain().focus().addColumnAfter().run();
      }
    },
    {
      label: "Del Table",
      title: "Delete table",
      action: function () {
        editor.chain().focus().deleteTable().run();
      },
      applyState: function (button) {
        button.disabled = !editor.can().chain().focus().deleteTable().run();
      }
    }
  ]);

  function syncToolbar() {
    groups.forEach(function (defs) {
      defs.forEach(function (def) {
        def.button.disabled = false;
        def.button.classList.remove("active");
        def.applyState(def.button);
      });
    });
  }

  editor.on("create", syncToolbar);
  editor.on("selectionUpdate", syncToolbar);
  editor.on("transaction", syncToolbar);
  editor.on("focus", syncToolbar);
  editor.on("blur", syncToolbar);
  syncToolbar();

  root.appendChild(toolbar);

  return toolbar;
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
  const normalizedInitialData = normalizeLegacyHtmlForTiptap(initialData);

  const root = document.createElement("div");
  root.className = "wiki-editor";

  const toolbarMount = document.createElement("div");
  toolbarMount.className = "wiki-editor__toolbar-mount";
  root.appendChild(toolbarMount);

  const editorMount = document.createElement("div");
  editorMount.className = "wiki-editor__surface wiki-article-prose";
  root.appendChild(editorMount);

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
        click: function (_view, event) {
          const target = event.target;
          const imageFigure = target && typeof target.closest === "function" ? target.closest('[data-wiki-node="image-figure"]') : null;
          const imageNode = target && typeof target.closest === "function" ? target.closest('img[data-wiki-node="image"]') : null;
          const mediaCell = target && typeof target.closest === "function" ? target.closest('[data-wiki-node="media-cell"]') : null;
          const link = target && typeof target.closest === "function" ? target.closest("a[href]") : null;
          if (link && editorMount.contains(link)) {
            event.preventDefault();
            event.stopPropagation();
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
        }
      }
    },
    onUpdate: function ({ editor: activeEditor }) {
      const plainTextLength = activeEditor.getText().trim().length;
      metaRow.textContent = `${plainTextLength.toLocaleString()} characters`;
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

    const url = await uploadImageFile(relativePath, csrfToken, file);
    editor.chain().focus().setImage({
      src: url,
      alt: file.name || ""
    }).run();
  });

  createToolbar(toolbarMount, editor, pickAndUploadImage);

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
