import "./wiki-editor.css";

import DOMPurify from "dompurify";
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

import sanitizerConfig from "../../shared/wiki-html-sanitizer-config.json";

const markdownIt = new MarkdownIt({ html: true, linkify: true, typographer: true });

const SUPPORTED_TIPTAP_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "img",
  "input",
  "label",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul"
]);

function createTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    emDelimiter: "*"
  });
  td.use(gfm);
  return td;
}

function getAllowedAttributesList() {
  const attrs = new Set(["href", "target", "rel", "src", "alt", "title", "width", "height", "type", "checked", "disabled"]);
  Object.values(sanitizerConfig.allowedAttributes || {}).forEach(function (list) {
    (list || []).forEach(function (name) {
      if (!name.endsWith("*")) {
        attrs.add(name);
      }
    });
  });
  return Array.from(attrs);
}

const DOMPURIFY_OPTIONS = {
  ALLOWED_TAGS: sanitizerConfig.allowedTags,
  ALLOWED_ATTR: getAllowedAttributesList(),
  ALLOW_DATA_ATTR: true
};

function unwrapElement(element) {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }

  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }

  parent.removeChild(element);
}

function replaceElement(element, replacement) {
  const parent = element.parentNode;
  if (!parent) {
    return;
  }

  parent.replaceChild(replacement, element);
}

function renameElement(document, element, tagName) {
  const replacement = document.createElement(tagName);
  Array.from(element.attributes || []).forEach(function (attr) {
    replacement.setAttribute(attr.name, attr.value);
  });

  while (element.firstChild) {
    replacement.appendChild(element.firstChild);
  }

  replaceElement(element, replacement);
}

function sanitizeAnchorTargets(root) {
  root.querySelectorAll("a[href]").forEach(function (link) {
    if (link.getAttribute("target") === "_blank" && !link.getAttribute("rel")) {
      link.setAttribute("rel", "noopener noreferrer");
    }
  });
}

export function normalizeLegacyHtmlForTiptap(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div data-root="1">${String(html || "")}</div>`, "text/html");
  const root = doc.body.firstElementChild;

  if (!root) {
    return "";
  }

  root.querySelectorAll("article, section, div").forEach(function (element) {
    if (element.getAttribute("data-root") === "1") {
      return;
    }
    unwrapElement(element);
  });

  root.querySelectorAll("h5, h6").forEach(function (element) {
    renameElement(doc, element, "h4");
  });

  root.querySelectorAll("figcaption").forEach(function (element) {
    renameElement(doc, element, "p");
  });

  root.querySelectorAll("figure").forEach(function (element) {
    unwrapElement(element);
  });

  root.querySelectorAll("dt").forEach(function (element) {
    const paragraph = doc.createElement("p");
    const strong = doc.createElement("strong");
    while (element.firstChild) {
      strong.appendChild(element.firstChild);
    }
    paragraph.appendChild(strong);
    replaceElement(element, paragraph);
  });

  root.querySelectorAll("dd").forEach(function (element) {
    renameElement(doc, element, "p");
  });

  root.querySelectorAll("dl").forEach(function (element) {
    unwrapElement(element);
  });

  return root.innerHTML.trim();
}

export function sanitizeHtml(html) {
  const clean = DOMPurify.sanitize(String(html || ""), DOMPURIFY_OPTIONS);
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${clean}</div>`, "text/html");
  sanitizeAnchorTargets(doc.body);
  return doc.body.innerHTML.trim();
}

export function htmlToMarkdown(html) {
  return createTurndown().turndown(html || "");
}

export function markdownToHtml(markdown) {
  return sanitizeHtml(markdownIt.render(markdown || ""));
}

export function detectUnsupportedContent(html) {
  const trimmed = normalizeLegacyHtmlForTiptap(String(html || "")).trim();
  if (!trimmed) {
    return "";
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div data-root="1">${trimmed}</div>`, "text/html");
  const elements = doc.body.querySelectorAll("*");

  for (const element of elements) {
    if (element.getAttribute("data-root") === "1") {
      continue;
    }

    const tag = element.tagName.toLowerCase();
    if (!SUPPORTED_TIPTAP_TAGS.has(tag)) {
      return `Legacy HTML uses <${tag}>, which this Tiptap surface does not preserve safely yet.`;
    }

    if (tag === "span") {
      const attrNames = element.getAttributeNames().filter(function (name) {
        return !name.startsWith("data-") && name !== "class";
      });
      if (attrNames.length > 0 || element.classList.length > 0) {
        return "Legacy HTML uses inline span markup that Tiptap would normalize or drop.";
      }
    }

    if (tag === "input" && element.getAttribute("type") !== "checkbox") {
      return "Legacy HTML uses form controls that are outside the supported wiki editor schema.";
    }
  }

  return "";
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
      Underline,
      Highlight,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https"
      }),
      Image.configure({
        allowBase64: true
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
          const link = target && typeof target.closest === "function" ? target.closest("a[href]") : null;
          if (link && editorMount.contains(link)) {
            event.preventDefault();
            event.stopPropagation();
            return true;
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
  normalizeLegacyHtmlForTiptap
};
