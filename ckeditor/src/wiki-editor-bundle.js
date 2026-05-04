/**
 * @license GPL-3.0-or-later
 * Bundles CKEditor 5 (GPL) and markdown helpers for the Westgate Wiki compose page.
 */
import "ckeditor5/ckeditor5.css";

import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import MarkdownIt from "markdown-it";

import {
  ClassicEditor,
  Plugin,
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  Code,
  Link,
  AutoLink,
  List,
  TodoList,
  ListProperties,
  ListFormatting,
  BlockQuote,
  CodeBlock,
  HorizontalLine,
  PageBreak,
  PastePlainText,
  PasteFromOffice,
  PasteFromMarkdownExperimental,
  Alignment,
  Indent,
  IndentBlock,
  Image,
  ImageToolbar,
  ImageCaption,
  ImageStyle,
  ImageResize,
  ImageUpload,
  LinkImage,
  MediaEmbed,
  HtmlEmbed,
  Table,
  TableToolbar,
  TableCaption,
  TableProperties,
  TableCellProperties,
  TableColumnResize,
  TableClipboard,
  TextPartLanguage,
  Font,
  FontColor,
  FontBackgroundColor,
  FontSize,
  FontFamily,
  Highlight,
  RemoveFormat,
  FindAndReplace,
  SourceEditing,
  ShowBlocks,
  GeneralHtmlSupport,
  SpecialCharacters,
  SpecialCharactersEssentials,
  SpecialCharactersArrows,
  SpecialCharactersText,
  SpecialCharactersMathematical,
  SpecialCharactersLatin,
  SpecialCharactersCurrency,
  WordCount,
  Fullscreen,
  Emoji,
  Autoformat,
  FileRepository
} from "ckeditor5";

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

function createNodebbUploadPlugin(relativePath, csrfToken) {
  return class NodebbUploadAdapter extends Plugin {
    static get pluginName() {
      return "NodebbUploadAdapter";
    }

    init() {
      const uploadUrl = `${relativePath || ""}/api/post/upload`;
      this.editor.plugins.get(FileRepository).createUploadAdapter = (loader) => ({
        upload: () => loader.file.then(
          (file) => new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", uploadUrl, true);
            xhr.setRequestHeader("x-csrf-token", csrfToken || "");
            xhr.withCredentials = true;
            xhr.addEventListener("load", () => {
              const { status, responseText } = xhr;
              if (status < 200 || status >= 300) {
                reject(new Error(responseText || `HTTP ${status}`));
                return;
              }
              try {
                const body = JSON.parse(responseText);
                const img = body.response?.images?.[0] || body.images?.[0];
                if (img && img.url) {
                  resolve({ default: img.url });
                  return;
                }
              } catch (err) {
                reject(err);
                return;
              }
              reject(new Error("Unexpected upload response"));
            });
            xhr.addEventListener("error", () => reject(new Error("Network error")));
            const fd = new FormData();
            fd.append("files[]", file);
            xhr.send(fd);
          })
        ),
        abort() {}
      });
    }
  };
}

const editorPlugins = [
  Essentials,
  Paragraph,
  Heading,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  Code,
  Link,
  AutoLink,
  List,
  TodoList,
  ListProperties,
  ListFormatting,
  BlockQuote,
  CodeBlock,
  HorizontalLine,
  PageBreak,
  PastePlainText,
  PasteFromOffice,
  PasteFromMarkdownExperimental,
  Alignment,
  Indent,
  IndentBlock,
  Image,
  ImageToolbar,
  ImageCaption,
  ImageStyle,
  ImageResize,
  ImageUpload,
  LinkImage,
  MediaEmbed,
  HtmlEmbed,
  Table,
  TableToolbar,
  TableCaption,
  TableProperties,
  TableCellProperties,
  TableColumnResize,
  TableClipboard,
  TextPartLanguage,
  Font,
  FontColor,
  FontBackgroundColor,
  FontSize,
  FontFamily,
  Highlight,
  RemoveFormat,
  FindAndReplace,
  SourceEditing,
  ShowBlocks,
  GeneralHtmlSupport,
  SpecialCharacters,
  SpecialCharactersEssentials,
  SpecialCharactersArrows,
  SpecialCharactersText,
  SpecialCharactersMathematical,
  SpecialCharactersLatin,
  SpecialCharactersCurrency,
  WordCount,
  Fullscreen,
  Emoji,
  Autoformat
];

const toolbarItems = [
  "undo",
  "redo",
  "|",
  "sourceEditing",
  "showBlocks",
  "findAndReplace",
  "|",
  "heading",
  "|",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "subscript",
  "superscript",
  "code",
  "removeFormat",
  "|",
  "fontSize",
  "fontFamily",
  "fontColor",
  "fontBackgroundColor",
  "highlight",
  "|",
  "link",
  "bulletedList",
  "numberedList",
  "todoList",
  "outdent",
  "indent",
  "|",
  "alignment",
  "|",
  "blockQuote",
  "codeBlock",
  "horizontalLine",
  "pageBreak",
  "|",
  "imageUpload",
  "mediaEmbed",
  "htmlEmbed",
  "insertTable",
  "|",
  "specialCharacters",
  "emoji",
  "textPartLanguage",
  "|",
  "fullscreen"
];

/**
 * @param {HTMLElement} element
 * @param {{ relativePath: string, csrfToken: string, initialData?: string }} options
 */
export async function createWikiEditor(element, options) {
  const { relativePath, csrfToken, initialData = "" } = options || {};
  const UploadPlugin = createNodebbUploadPlugin(relativePath, csrfToken);

  const editor = await ClassicEditor.create(element, {
    licenseKey: "GPL",
    /*
     * GPL: the "Powered by" affordance is required. Keep it in the official layout
     * (inside the editing surface) so it is not a stray body-level strip after ajaxify.
     * @see https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/managing-ckeditor-logo.html
     */
    ui: {
      poweredBy: {
        position: "inside",
        side: "right"
      }
    },
    plugins: [...editorPlugins, UploadPlugin],
    toolbar: {
      items: toolbarItems,
      shouldNotGroupWhenFull: true
    },
    language: "en",
    heading: {
      options: [
        { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
        { model: "heading1", view: "h1", title: "Heading 1", class: "ck-heading_heading1" },
        { model: "heading2", view: "h2", title: "Heading 2", class: "ck-heading_heading2" },
        { model: "heading3", view: "h3", title: "Heading 3", class: "ck-heading_heading3" },
        { model: "heading4", view: "h4", title: "Heading 4", class: "ck-heading_heading4" }
      ]
    },
    image: {
      toolbar: [
        "imageStyle:inline",
        "imageStyle:block",
        "imageStyle:side",
        "|",
        "toggleImageCaption",
        "imageTextAlternative",
        "linkImage"
      ]
    },
    table: {
      contentToolbar: [
        "tableColumn",
        "tableRow",
        "mergeTableCells",
        "tableProperties",
        "tableCellProperties"
      ]
    },
    htmlSupport: {
      allow: [
        {
          name: /.*/,
          attributes: true,
          classes: true,
          styles: true
        }
      ]
    },
    initialData
  });

  const editableEl =
    typeof editor.ui.getEditableElement === "function"
      ? editor.ui.getEditableElement()
      : editor.ui && editor.ui.view && editor.ui.view.editable && editor.ui.view.editable.element;
  if (editableEl) {
    editableEl.classList.add("wiki-article-prose");
    disableEditableLinkNavigation(editableEl);
  }

  reparentCKEditorBodyWrapper(editor);

  return editor;
}

/**
 * Links inside CKEditor's editable area are content, not navigation controls. NodeBB's
 * ajaxify click handling can otherwise treat an authoring click as a page transition.
 * @param {HTMLElement} editableEl
 */
function disableEditableLinkNavigation(editableEl) {
  const blockNavigation = (event) => {
    const target = event.target;
    const link = target && typeof target.closest === "function" ? target.closest("a[href]") : null;
    if (!link || !editableEl.contains(link)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };

  editableEl.addEventListener("click", blockNavigation, true);
  editableEl.addEventListener("auxclick", blockNavigation, true);
}

/**
 * BodyCollection.attachToDom() appends a shared div.ck-body-wrapper to document.body. That is correct for
 * standalone pages but breaks NodeBB layout (full-width / flex / theme rules on body children). Move the
 * wrapper into the compose root so CKEditor UI layers stay in the wiki compose subtree.
 * @param {*} editor
 */
function reparentCKEditorBodyWrapper(editor) {
  const sink = document.getElementById("westgate-wiki-ck-body-sink");
  const bodyView = editor.ui && editor.ui.view && editor.ui.view.body;
  const collectionRoot = bodyView && bodyView.bodyCollectionContainer;
  if (!sink || !collectionRoot) {
    return;
  }
  const wrap = collectionRoot.parentElement;
  if (!wrap || !wrap.classList || !wrap.classList.contains("ck-body-wrapper")) {
    return;
  }
  if (wrap.parentNode !== sink) {
    sink.appendChild(wrap);
  }
}

export function htmlToMarkdown(html) {
  return createTurndown().turndown(html || "");
}

export function markdownToHtml(markdown) {
  return markdownIt.render(markdown || "");
}
