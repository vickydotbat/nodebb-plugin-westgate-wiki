import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { installJsdomGlobals } from "./helpers/jsdom-setup.mjs";

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result.then(function () {
        process.stdout.write(`ok - ${name}\n`);
      });
    }
    process.stdout.write(`ok - ${name}\n`);
  } catch (err) {
    process.stderr.write(`not ok - ${name}\n`);
    throw err;
  }
  return Promise.resolve();
}

installJsdomGlobals();

const [{ Editor }, StarterKitModule, ImageModule, PreservedNodeAttributesModule, StyledSpanModule, ContainerBlockModule, MediaRowModule, ImageFigureModule, WikiCalloutModule, SlashCommandModule, WikiLinkModule, toolbarSchemaModule, editorTocModule, linkInteractionsModule, legacyHtmlModule, sanitizerContractModule] = await Promise.all([
  import("@tiptap/core"),
  import("@tiptap/starter-kit"),
  import("@tiptap/extension-image"),
  import("../tiptap/src/extensions/preserved-node-attributes.mjs"),
  import("../tiptap/src/extensions/styled-span.mjs"),
  import("../tiptap/src/extensions/container-block.mjs"),
  import("../tiptap/src/extensions/media-row.mjs"),
  import("../tiptap/src/extensions/image-figure.mjs"),
  import("../tiptap/src/extensions/wiki-callout.mjs"),
  import("../tiptap/src/extensions/slash-command.mjs"),
  import("../tiptap/src/extensions/wiki-link.mjs"),
  import("../tiptap/src/toolbar/toolbar-schema.mjs"),
  import("../tiptap/src/toolbar/editor-toc.mjs"),
  import("../tiptap/src/selection/link-interactions.mjs"),
  import("../tiptap/src/normalization/legacy-html.mjs"),
  import("../tiptap/src/shared/sanitizer-contract.mjs")
]);

const StarterKit = StarterKitModule.default;
const Image = ImageModule.default;
const PreservedNodeAttributes = PreservedNodeAttributesModule.default;
const StyledSpan = StyledSpanModule.default;
const ContainerBlock = ContainerBlockModule.default;
const { MediaCell, MediaRow } = MediaRowModule;
const ImageFigure = ImageFigureModule.default;
const WikiCallout = WikiCalloutModule.default;
const SlashCommand = SlashCommandModule.default;
const WikiLink = WikiLinkModule.default;
const { IMAGE_CONTEXT_BUTTON_IDS, TABLE_CONTEXT_BUTTON_IDS, TOP_TOOLBAR_BUTTON_IDS, TOP_TOOLBAR_GROUPS } = toolbarSchemaModule;
const { buildHeadingToc, navigateToHeading } = editorTocModule;
const { installEditorLinkNavigationGuard, selectEditorLink } = linkInteractionsModule;
const {
  detectUnsupportedContent,
  getNormalizationNotice,
  normalizeLegacyHtmlForTiptap
} = legacyHtmlModule;
const { sanitizeHtml } = sanitizerContractModule;
const articleBodyCss = readFileSync(new URL("../public/wiki-article-body.css", import.meta.url), "utf8");
const editorCss = readFileSync(new URL("../tiptap/src/wiki-editor.css", import.meta.url), "utf8");
const vendoredEditorCss = readFileSync(new URL("../public/vendor/tiptap/wiki-tiptap.css", import.meta.url), "utf8");

function createEditor(content) {
  const mount = document.createElement("div");
  document.body.appendChild(mount);

  return new Editor({
    element: mount,
    extensions: [
      StarterKit.configure({
        link: false,
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
      WikiLink.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https"
      }),
      SlashCommand.configure({
        getItems: function () {
          return [
            {
              id: "warning-callout",
              label: "Warning callout",
              run: function ({ editor: activeEditor }) {
                activeEditor.chain().focus().insertWikiCallout({ type: "warning", title: "Compatibility" }).run();
              }
            }
          ];
        }
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          "data-wiki-node": "image"
        }
      })
    ],
    content: content || ""
  });
}

await test("normalizeLegacyHtmlForTiptap converts legacy media layouts into wiki media rows", function () {
  const normalized = normalizeLegacyHtmlForTiptap(
    '<div style="display:flex"><img src="/one.png" alt="One"><div style="display:block"><p>Two</p></div></div>'
  );

  assert.match(normalized, /class="wiki-media-row"/);
  assert.match(normalized, /class="wiki-media-cell"/);
  assert.doesNotMatch(normalized, /display:flex/);
});

await test("normalizeLegacyHtmlForTiptap keeps supported image figures and normalizes presentational markup", function () {
  const normalized = normalizeLegacyHtmlForTiptap(
    '<center><figure class="image image-style-side"><a href="/full.png"><img src="/thumb.png" alt="Thumb" width="120"></a><figcaption><font color="#caa55a" size="5">Caption</font></figcaption></figure></center>'
  );

  assert.match(normalized, /<p style="text-align: center">/);
  assert.match(normalized, /<figure class="image image-style-side">/);
  assert.match(normalized, /<span[^>]*style="[^"]*font-size: 1\.5rem[^"]*"[^>]*>Caption<\/span>/);
});

await test("detectUnsupportedContent rejects unsupported embeds and accepts supported legacy figure content", function () {
  assert.match(
    detectUnsupportedContent('<p>Video</p><iframe src="https://example.test/embed"></iframe>'),
    /<iframe>/
  );

  assert.equal(
    detectUnsupportedContent('<figure class="image"><img src="/ok.png" alt="Ok"><figcaption><span class="legacy-accent">Safe</span></figcaption></figure>'),
    ""
  );
});

await test("getNormalizationNotice reports when legacy html changes materially", function () {
  assert.equal(getNormalizationNotice("<p>Plain</p>"), "");
  assert.match(getNormalizationNotice("<center>Centered</center>"), /normalized to the supported Tiptap schema/);
});

await test("sanitizeHtml preserves safe styles and removes unsafe ones on the client contract", function () {
  const sanitized = sanitizeHtml('<p style="text-align: center; position: fixed; color: rgb(10, 20, 30)">Styled</p>');

  assert.match(sanitized, /text-align:\s*center/);
  assert.match(sanitized, /color:\s*rgb\(10, 20, 30\)/);
  assert.doesNotMatch(sanitized, /position:/);
});

await test("article prose css renders Tiptap task lists without list bullets", function () {
  assert.match(articleBodyCss, /\.wiki-article-prose\s+ul\[data-type="taskList"\]/);
  assert.match(articleBodyCss, /ul\[data-type="taskList"\]\s*{[^}]*list-style:\s*none/);
  assert.match(articleBodyCss, /ul\[data-type="taskList"\]\s*>\s*li\s*{[^}]*display:\s*flex/);
  assert.doesNotMatch(articleBodyCss, /ul\[data-type="taskList"\]\s*>\s*li\s*{[^}]*align-items:\s*center/);
  assert.match(articleBodyCss, /ul\[data-type="taskList"\]\s*>\s*li\s*>\s*label\s*{[^}]*margin-top:\s*0\.35rem/);
  assert.match(articleBodyCss, /ul\[data-type="taskList"\]\s*>\s*li\s*>\s*div\s*>\s*p\s*{[^}]*margin-bottom:\s*0/);
  assert.match(articleBodyCss, /ul\[data-type="taskList"\]\s+ul\[data-type="taskList"\]\s*{[^}]*margin-top:\s*0/);
  assert.match(articleBodyCss, /ul\[data-type="taskList"\]\s+ul\[data-type="taskList"\]\s*{[^}]*margin-bottom:\s*0/);
});

await test("editor toolbar renders as a bordered self-contained sticky panel", function () {
  [editorCss, vendoredEditorCss].forEach(function (css) {
    assert.match(css, /\.wiki-editor__toolbar-mount\s*{[^}]*border:\s*1px\s+solid\s+var\(--wiki-editor-toolbar-border/);
    assert.match(css, /\.wiki-editor__toolbar-mount\s*{[^}]*border-radius:\s*var\(--bs-border-radius/);
    assert.match(css, /\.wiki-editor__toolbar-mount\s*{[^}]*margin:\s*(?:0\.75rem|\.75rem)\s+(?:0\.75rem|\.75rem)\s+0/);
    assert.doesNotMatch(css, /\.wiki-editor__toolbar-mount\s*{[^}]*box-shadow:\s*0\s+calc\(-1\s*\*/);
  });
});

await test("styled span classes and styles round-trip through the extracted extension layer", function () {
  const editor = createEditor('<p><span class="legacy-accent" style="font-size: 1.2rem; color: #caa55a">Accent</span></p>');
  const rendered = editor.getHTML();

  assert.match(rendered, /<span class="legacy-accent" style="font-size: 1\.2rem; color: rgb\(202, 165, 90\);">Accent<\/span>/);
  editor.destroy();
});

await test("imageFigure parses and renders linked figures with captions intact", function () {
  const editor = createEditor(
    '<figure class="image image-style-align-right wiki-image-size-md" id="hero"><a href="/full.png" target="_blank" rel="noopener noreferrer"><img src="/thumb.png" alt="Thumb" width="240"></a><figcaption><p>Caption</p></figcaption></figure>'
  );
  const rendered = editor.getHTML();

  assert.match(rendered, /<figure class="image image-style-align-right wiki-image-size-md" data-wiki-node="image-figure" id="hero">/);
  assert.match(rendered, /<a href="\/full\.png" target="_blank" rel="noopener noreferrer"><img src="\/thumb\.png" alt="Thumb" width="240"><\/a>/);
  assert.match(rendered, /<figcaption><p>Caption<\/p><\/figcaption>/);
  editor.destroy();
});

await test("mediaRow insert command renders bounded two- and three-cell layouts", function () {
  const editor = createEditor("<p>Start</p>");

  editor.commands.insertMediaRow(99);
  const rendered = editor.getHTML();
  const cellCount = (rendered.match(/data-wiki-node="media-cell"/g) || []).length;

  assert.match(rendered, /data-wiki-node="media-row"/);
  assert.equal(cellCount, 3);
  editor.destroy();
});

await test("mediaRow two-up html round-trips without containerBlock wrappers manufacturing extra cells", function () {
  const savedHtml = '<div class="wiki-media-row" data-wiki-node="media-row"><div class="wiki-media-cell" data-wiki-node="media-cell"><img data-wiki-node="image" src="/a.png"></div><div class="wiki-media-cell" data-wiki-node="media-cell"><img data-wiki-node="image" src="/b.png"></div></div>';
  const firstOpen = createEditor(savedHtml);
  const firstRender = firstOpen.getHTML();

  assert.equal((firstRender.match(/data-wiki-node="media-row"/g) || []).length, 1);
  assert.equal((firstRender.match(/data-wiki-node="media-cell"/g) || []).length, 2);

  const reopened = createEditor(sanitizeHtml(firstRender));
  const secondRender = reopened.getHTML();

  assert.equal((secondRender.match(/data-wiki-node="media-row"/g) || []).length, 1);
  assert.equal((secondRender.match(/data-wiki-node="media-cell"/g) || []).length, 2);
  assert.doesNotMatch(secondRender, /<div class="wiki-media-row"><div class="wiki-media-row"/);

  firstOpen.destroy();
  reopened.destroy();
});

await test("wiki link mark stores regular links as inert spans in the editor contract", function () {
  const editor = createEditor('<p>A <a target="_blank" rel="noopener noreferrer" href="https://google.com">regular link</a>.</p>');
  const rendered = editor.getHTML();

  assert.match(rendered, /<span class="wiki-editor-link" data-wiki-link-href="https:\/\/google\.com"/);
  assert.match(rendered, /data-wiki-link-target="_blank"/);
  assert.match(rendered, /data-wiki-link-rel="noopener noreferrer"/);
  assert.doesNotMatch(rendered, /<a\b[^>]*href="https:\/\/google\.com"/);
  editor.commands.setTextSelection(5);
  assert.equal(editor.getAttributes("link").href, "https://google.com");

  editor.destroy();
});

await test("editor link navigation guard cancels link clicks before page handlers run", function () {
  const editorMount = document.createElement("div");
  const link = document.createElement("a");
  const linkText = document.createTextNode("Westgate");
  let selectedLink = null;
  let toolbarLink = null;
  let bubbled = false;
  function recordBubble() {
    bubbled = true;
  }

  link.href = "https://example.test/wiki/westgate";
  link.appendChild(linkText);
  editorMount.appendChild(link);
  document.body.appendChild(editorMount);
  document.body.addEventListener("click", recordBubble);

  const destroyGuard = installEditorLinkNavigationGuard({
    editorMount,
    editor: {
      view: {
        posAtDOM: function (target) {
          assert.equal(target, linkText);
          return 7;
        }
      },
      chain: function () {
        return {
          focus: function () {
            return this;
          },
          setTextSelection: function (pos) {
            assert.equal(pos, 7);
            selectedLink = link;
            return this;
          },
          extendMarkRange: function (markName) {
            assert.equal(markName, "link");
            return this;
          },
          run: function () {
            return true;
          }
        };
      }
    },
    getLinkContextToolbar: function () {
      return {
        showForLink: function (activeLink) {
          toolbarLink = activeLink;
        }
      };
    }
  });

  const event = new window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0
  });
  const notCanceled = link.dispatchEvent(event);

  assert.equal(notCanceled, false);
  assert.equal(event.defaultPrevented, true);
  assert.equal(bubbled, false);
  assert.equal(selectedLink, link);
  assert.equal(toolbarLink, link);

  destroyGuard();
  document.body.removeEventListener("click", recordBubble);
  editorMount.remove();
});

await test("editor link navigation guard opens link tools for inert editor link spans", function () {
  const editorMount = document.createElement("div");
  const link = document.createElement("span");
  const linkText = document.createTextNode("essential");
  let selectedLink = null;
  let toolbarLink = null;

  link.className = "wiki-editor-link";
  link.setAttribute("data-wiki-link-href", "https://google.com");
  link.appendChild(linkText);
  editorMount.appendChild(link);
  document.body.appendChild(editorMount);

  const destroyGuard = installEditorLinkNavigationGuard({
    editorMount,
    editor: {
      view: {
        posAtDOM: function (target) {
          assert.equal(target, linkText);
          return 4;
        }
      },
      chain: function () {
        return {
          focus: function () {
            return this;
          },
          setTextSelection: function (pos) {
            assert.equal(pos, 4);
            selectedLink = link;
            return this;
          },
          extendMarkRange: function (markName) {
            assert.equal(markName, "link");
            return this;
          },
          run: function () {
            return true;
          }
        };
      }
    },
    getLinkContextToolbar: function () {
      return {
        showForLink: function (activeLink) {
          toolbarLink = activeLink;
        }
      };
    }
  });

  const event = new window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0
  });
  const notCanceled = link.dispatchEvent(event);

  assert.equal(notCanceled, false);
  assert.equal(event.defaultPrevented, true);
  assert.equal(selectedLink, link);
  assert.equal(toolbarLink, link);

  destroyGuard();
  editorMount.remove();
});

await test("editor link navigation guard opens link tools when clicking inert link text nodes", function () {
  const editorMount = document.createElement("div");
  const link = document.createElement("span");
  const linkText = document.createTextNode("https://github.com/gitextensions/gitextensions/releases/latest");
  let selectedLink = null;
  let toolbarLink = null;

  link.className = "wiki-editor-link";
  link.setAttribute("data-wiki-link-href", "https://github.com/gitextensions/gitextensions/releases/latest");
  link.setAttribute("data-wiki-link-target", "_blank");
  link.setAttribute("data-wiki-link-rel", "noopener noreferrer nofollow");
  link.appendChild(linkText);
  editorMount.appendChild(link);
  document.body.appendChild(editorMount);

  const destroyGuard = installEditorLinkNavigationGuard({
    editorMount,
    editor: {
      view: {
        posAtDOM: function (target) {
          assert.equal(target, linkText);
          return 12;
        }
      },
      chain: function () {
        return {
          focus: function () {
            return this;
          },
          setTextSelection: function (pos) {
            assert.equal(pos, 12);
            selectedLink = link;
            return this;
          },
          extendMarkRange: function (markName) {
            assert.equal(markName, "link");
            return this;
          },
          run: function () {
            return true;
          }
        };
      }
    },
    getLinkContextToolbar: function () {
      return {
        showForLink: function (activeLink) {
          toolbarLink = activeLink;
        }
      };
    }
  });

  const event = new window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0
  });
  const notCanceled = linkText.dispatchEvent(event);

  assert.equal(notCanceled, false);
  assert.equal(event.defaultPrevented, true);
  assert.equal(selectedLink, link);
  assert.equal(toolbarLink, link);

  destroyGuard();
  editorMount.remove();
});

await test("editor link navigation guard opens link tools on mousedown before text selection changes", function () {
  const editorMount = document.createElement("div");
  const link = document.createElement("span");
  const linkText = document.createTextNode("https://git-scm.com/download/win");
  let selectedLink = null;
  let toolbarLink = null;

  link.className = "wiki-editor-link";
  link.setAttribute("data-wiki-link-href", "https://git-scm.com/download/win");
  link.appendChild(linkText);
  editorMount.appendChild(link);
  document.body.appendChild(editorMount);

  const destroyGuard = installEditorLinkNavigationGuard({
    editorMount,
    editor: {
      view: {
        posAtDOM: function (target) {
          assert.equal(target, linkText);
          return 16;
        }
      },
      chain: function () {
        return {
          focus: function () {
            return this;
          },
          setTextSelection: function (pos) {
            assert.equal(pos, 16);
            selectedLink = link;
            return this;
          },
          extendMarkRange: function (markName) {
            assert.equal(markName, "link");
            return this;
          },
          run: function () {
            return true;
          }
        };
      }
    },
    getLinkContextToolbar: function () {
      return {
        showForLink: function (activeLink) {
          toolbarLink = activeLink;
        }
      };
    }
  });

  const event = new window.MouseEvent("mousedown", {
    bubbles: true,
    cancelable: true,
    button: 0
  });
  const notCanceled = linkText.dispatchEvent(event);

  assert.equal(notCanceled, false);
  assert.equal(event.defaultPrevented, true);
  assert.equal(selectedLink, link);
  assert.equal(toolbarLink, link);

  destroyGuard();
  editorMount.remove();
});

await test("selectEditorLink activates the link mark for long inert URL spans", function () {
  const editor = createEditor('<p><span class="wiki-editor-link" data-wiki-link-href="https://github.com/gitextensions/gitextensions/releases/latest" data-wiki-link-target="_blank" data-wiki-link-rel="noopener noreferrer nofollow">https://github.com/gitextensions/gitextensions/releases/latest</span></p>');
  const link = editor.view.dom.querySelector("[data-wiki-link-href]");

  assert.ok(link, "expected rendered inert link span");
  assert.equal(selectEditorLink(editor, link), true);
  assert.equal(editor.isActive("link"), true);
  assert.equal(editor.getAttributes("link").href, "https://github.com/gitextensions/gitextensions/releases/latest");

  editor.destroy();
});

await test("editor link navigation guard cancels links before document capture navigation handlers", function () {
  const editorMount = document.createElement("div");
  const link = document.createElement("a");
  const linkText = document.createTextNode("essential");
  let documentCaptureSawNavigation = false;

  link.href = "https://google.com/";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.appendChild(linkText);
  editorMount.appendChild(link);
  document.body.appendChild(editorMount);

  function recordDocumentCapture(event) {
    if (!event.defaultPrevented) {
      documentCaptureSawNavigation = true;
    }
  }

  document.addEventListener("click", recordDocumentCapture, true);

  const destroyGuard = installEditorLinkNavigationGuard({
    editorMount,
    editor: {
      view: {
        posAtDOM: function () {
          return 3;
        }
      },
      chain: function () {
        return {
          focus: function () {
            return this;
          },
          setTextSelection: function () {
            return this;
          },
          extendMarkRange: function () {
            return this;
          },
          run: function () {
            return true;
          }
        };
      }
    },
    getLinkContextToolbar: function () {
      return null;
    }
  });

  const event = new window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0
  });
  link.dispatchEvent(event);

  assert.equal(event.defaultPrevented, true);
  assert.equal(documentCaptureSawNavigation, false);

  destroyGuard();
  document.removeEventListener("click", recordDocumentCapture, true);
  editorMount.remove();
});

await test("wikiCallout parses and renders safe callout HTML", function () {
  const editor = createEditor('<aside class="wiki-callout wiki-callout--warning" data-callout-type="warning" data-callout-title="Compatibility"><p><strong>Compatibility</strong></p><p>Test custom CSS.</p></aside>');
  const rendered = editor.getHTML();

  assert.match(rendered, /<aside class="wiki-callout wiki-callout--warning" data-callout-type="warning" data-callout-title="Compatibility">/);
  assert.match(rendered, /<p><strong>Compatibility<\/strong><\/p>/);
  assert.match(rendered, /<p>Test custom CSS\.<\/p>/);
  editor.destroy();
});

await test("wikiCallout insert command creates a warning callout", function () {
  const editor = createEditor("<p>Start</p>");

  editor.commands.insertWikiCallout({ type: "warning", title: "Compatibility" });
  const rendered = editor.getHTML();

  assert.match(rendered, /data-callout-type="warning"/);
  assert.match(rendered, /<strong>Compatibility<\/strong>/);
  editor.destroy();
});

await test("slash command extension exposes keyboard-selectable command state", function () {
  const editor = createEditor("<p>/</p>");

  assert.equal(typeof editor.commands.openWikiSlashMenu, "function");
  editor.chain().setTextSelection(2).run();
  editor.commands.insertContent(" ");
  editor.commands.deleteRange({ from: 2, to: 3 });
  assert.equal(editor.storage.slashCommand.isOpen, true);
  assert.equal(editor.storage.slashCommand.activeIndex, 0);

  editor.destroy();
});

await test("top toolbar schema excludes contextual image layout and size controls", function () {
  IMAGE_CONTEXT_BUTTON_IDS.forEach(function (id) {
    assert.equal(TOP_TOOLBAR_BUTTON_IDS.includes(id), false);
  });

  assert.equal(TOP_TOOLBAR_BUTTON_IDS.includes("image-upload"), true);
  assert.equal(IMAGE_CONTEXT_BUTTON_IDS.includes("image-size-md"), true);
  assert.equal(IMAGE_CONTEXT_BUTTON_IDS.includes("image-align-right"), true);
});

await test("top toolbar schema keeps only table creation in the always-visible toolbar", function () {
  const groupIds = TOP_TOOLBAR_GROUPS.map(function (group) {
    return group.id;
  });
  assert.deepEqual(groupIds, [
    "history",
    "structure",
    "inline-formatting",
    "links-media",
    "blocks",
    "callouts",
    "alignment",
    "tables"
  ]);

  const history = TOP_TOOLBAR_GROUPS.find(function (group) { return group.id === "history"; });
  const media = TOP_TOOLBAR_GROUPS.find(function (group) { return group.id === "links-media"; });
  const tables = TOP_TOOLBAR_GROUPS.find(function (group) { return group.id === "tables"; });

  assert.deepEqual(history.buttonIds, ["undo", "redo"]);
  assert.deepEqual(media.buttonIds, ["link", "unlink", "image-upload", "media-row-2", "media-row-3"]);
  assert.deepEqual(tables.buttonIds, ["table-insert"]);
});

await test("contextual table schema exposes row, column, cell merge, and delete tools", function () {
  assert.deepEqual(TABLE_CONTEXT_BUTTON_IDS, [
    "table-add-row-before",
    "table-add-row-after",
    "table-delete-row",
    "table-add-column-before",
    "table-add-column-after",
    "table-delete-column",
    "table-merge-cells",
    "table-split-cell",
    "table-toggle-header-row",
    "table-toggle-header-column",
    "table-delete"
  ]);
});

await test("buildHeadingToc nests smaller headings under the nearest larger heading", function () {
  const editor = createEditor(
    "<h1>Root</h1><p>Intro</p><h2>Child</h2><h3>Grandchild</h3><h2>Second Child</h2><h4>Deep Direct</h4><h1>Next Root</h1>"
  );
  const toc = buildHeadingToc(editor);

  assert.equal(toc.length, 2);
  assert.equal(toc[0].text, "Root");
  assert.equal(toc[0].children.length, 2);
  assert.equal(toc[0].children[0].text, "Child");
  assert.equal(toc[0].children[0].children[0].text, "Grandchild");
  assert.equal(toc[0].children[1].text, "Second Child");
  assert.equal(toc[0].children[1].children[0].text, "Deep Direct");
  assert.equal(toc[1].text, "Next Root");
  assert.match(toc[0].id, /^wiki-editor-heading-/);
  editor.destroy();
});

await test("navigateToHeading scrolls the ProseMirror heading position without refocusing the editor", function () {
  const originalScrollTo = window.scrollTo;
  const originalPageYOffset = window.pageYOffset;
  let scrollOptions = null;
  let focusCount = 0;
  const heading = document.createElement("h2");
  heading.id = "wiki-editor-heading-1-target";
  heading.getBoundingClientRect = function () {
    return { top: 240, left: 0, right: 0, bottom: 270, width: 100, height: 30 };
  };
  heading.scrollIntoView = function () {
    throw new Error("navigateToHeading should use deterministic scroll coordinates");
  };
  Object.defineProperty(window, "pageYOffset", { configurable: true, value: 100 });
  window.scrollTo = function (options) {
    scrollOptions = options;
  };

  const surface = document.createElement("div");
  surface.appendChild(heading);

  try {
    navigateToHeading({
      item: { id: heading.id, pos: 7 },
      surface,
      editor: {
        view: {
          nodeDOM: function (pos) {
            return pos === 7 ? heading : null;
          }
        },
        commands: {
          focus: function () {
            focusCount += 1;
          }
        }
      }
    });

    assert.deepEqual(scrollOptions, { top: 328, behavior: "smooth" });
    assert.equal(focusCount, 0);
  } finally {
    window.scrollTo = originalScrollTo;
    Object.defineProperty(window, "pageYOffset", { configurable: true, value: originalPageYOffset });
  }
});
