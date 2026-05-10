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

const [{ Editor }, StarterKitModule, HighlightModule, ImageModule, TableModule, TableCellModule, TableHeaderModule, TableRowModule, PreservedNodeAttributesModule, StyledSpanModule, ContainerBlockModule, MediaRowModule, ImageFigureModule, WikiCalloutModule, WikiEditingKeymapModule, SlashCommandModule, WikiCodeBlockModule, WikiBlockBackgroundModule, WikiLinkModule, WikiEntitiesModule, toolbarSchemaModule, editorTocModule, linkInteractionsModule, imageResizeModule, legacyHtmlModule, sanitizerContractModule, colorContrastModule] = await Promise.all([
  import("@tiptap/core"),
  import("@tiptap/starter-kit"),
  import("../tiptap/src/extensions/wiki-highlight.mjs"),
  import("@tiptap/extension-image"),
  import("@tiptap/extension-table"),
  import("@tiptap/extension-table-cell"),
  import("@tiptap/extension-table-header"),
  import("@tiptap/extension-table-row"),
  import("../tiptap/src/extensions/preserved-node-attributes.mjs"),
  import("../tiptap/src/extensions/styled-span.mjs"),
  import("../tiptap/src/extensions/container-block.mjs"),
  import("../tiptap/src/extensions/media-row.mjs"),
  import("../tiptap/src/extensions/image-figure.mjs"),
  import("../tiptap/src/extensions/wiki-callout.mjs"),
  import("../tiptap/src/extensions/wiki-editing-keymap.mjs"),
  import("../tiptap/src/extensions/slash-command.mjs"),
  import("../tiptap/src/extensions/wiki-code-block.mjs"),
  import("../tiptap/src/extensions/wiki-block-background.mjs"),
  import("../tiptap/src/extensions/wiki-link.mjs"),
  import("../tiptap/src/extensions/wiki-entities.mjs"),
  import("../tiptap/src/toolbar/toolbar-schema.mjs"),
  import("../tiptap/src/toolbar/editor-toc.mjs"),
  import("../tiptap/src/selection/link-interactions.mjs"),
  import("../tiptap/src/selection/image-resize.mjs"),
  import("../tiptap/src/normalization/legacy-html.mjs"),
  import("../tiptap/src/shared/sanitizer-contract.mjs"),
  import("../tiptap/src/shared/color-contrast.mjs")
]);

const StarterKit = StarterKitModule.default;
const Highlight = HighlightModule.default;
const Image = ImageModule.default;
const { Table } = TableModule;
const { TableCell } = TableCellModule;
const { TableHeader } = TableHeaderModule;
const { TableRow } = TableRowModule;
const PreservedNodeAttributes = PreservedNodeAttributesModule.default;
const StyledSpan = StyledSpanModule.default;
const ContainerBlock = ContainerBlockModule.default;
const { MediaCell, MediaRow } = MediaRowModule;
const ImageFigure = ImageFigureModule.default;
const WikiCallout = WikiCalloutModule.default;
const WikiEditingKeymap = WikiEditingKeymapModule.default;
const SlashCommand = SlashCommandModule.default;
const WikiCodeBlock = WikiCodeBlockModule.default;
const WikiBlockBackground = WikiBlockBackgroundModule.default;
const WikiLink = WikiLinkModule.default;
const { WikiFootnote, WikiNamespaceLink, WikiPageLink, WikiUserMention } = WikiEntitiesModule;
const { IMAGE_CONTEXT_BUTTON_IDS, TABLE_CONTEXT_BUTTON_IDS, TOP_TOOLBAR_BUTTON_IDS, TOP_TOOLBAR_GROUPS } = toolbarSchemaModule;
const { buildHeadingToc, navigateToHeading } = editorTocModule;
const { installEditorLinkNavigationGuard, selectEditorLink } = linkInteractionsModule;
const { calculateResizedImageWidth, setSelectedImageWidth } = imageResizeModule;
const {
  detectUnsupportedContent,
  getNormalizationNotice,
  normalizeLegacyHtmlForTiptap
} = legacyHtmlModule;
const { sanitizeHtml } = sanitizerContractModule;
const { getReadableTextColor, normalizeHexColor } = colorContrastModule;
const articleBodyCss = readFileSync(new URL("../public/wiki-article-body.css", import.meta.url), "utf8");
const wikiJsSource = readFileSync(new URL("../public/wiki.js", import.meta.url), "utf8");
const editorCss = readFileSync(new URL("../tiptap/src/wiki-editor.css", import.meta.url), "utf8");
const vendoredEditorCss = readFileSync(new URL("../public/vendor/tiptap/wiki-tiptap.css", import.meta.url), "utf8");
const editorBundleSource = readFileSync(new URL("../tiptap/src/wiki-editor-bundle.js", import.meta.url), "utf8");
const vendoredEditorBundleSource = readFileSync(new URL("../public/vendor/tiptap/wiki-tiptap.bundle.js", import.meta.url), "utf8");

function createEditor(content) {
  const mount = document.createElement("div");
  document.body.appendChild(mount);

  return new Editor({
    element: mount,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
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
      WikiEditingKeymap,
      WikiCodeBlock,
      WikiBlockBackground,
      Highlight.configure({
        multicolor: true
      }),
      WikiPageLink,
      WikiNamespaceLink,
      WikiUserMention,
      WikiFootnote,
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
      }),
      Table,
      TableRow,
      TableHeader,
      TableCell
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

await test("normalizeLegacyHtmlForTiptap converts legacy wiki inline syntax into entity spans", function () {
  const normalized = normalizeLegacyHtmlForTiptap(
    '<p>See [[Guides/Map Creation Guide|Map guide]], [[ns:Guides]], @xtul, and ((Important note)). <code>[[Raw]] @raw ((raw))</code></p>'
  );

  assert.match(normalized, /data-wiki-entity="page"/);
  assert.match(normalized, /data-wiki-target="Guides\/Map Creation Guide"/);
  assert.match(normalized, /data-wiki-entity="namespace"/);
  assert.match(normalized, /data-wiki-target="Guides"/);
  assert.match(normalized, /data-wiki-entity="user"/);
  assert.match(normalized, /data-wiki-username="xtul"/);
  assert.match(normalized, /data-wiki-entity="footnote"/);
  assert.match(normalized, /data-wiki-footnote="Important note"/);
  assert.match(normalized, /<code>\[\[Raw\]\] @raw \(\(raw\)\)<\/code>/);
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

await test("editor toolbar active buttons keep icon color readable", function () {
  [editorCss, vendoredEditorCss].forEach(function (css) {
    assert.match(css, /\.wiki-editor-toolbar__button\s*{[^}]*--bs-btn-active-color:\s*var\(--bs-btn-color,\s*currentColor\)/);
    assert.match(css, /\.wiki-editor-toolbar__button\.active\s*{[^}]*color:\s*var\(--bs-btn-active-color\)/);
    assert.doesNotMatch(css, /(?:^|\n)\s*color:\s*var\(--bs-btn-active-bg\)/);
  });
});

await test("editor image resize handles are scoped and draggable from the corners", function () {
  [editorCss, vendoredEditorCss].forEach(function (css) {
    assert.match(css, /\.westgate-wiki-compose \.wiki-editor-image-resize\s*{/);
    assert.match(css, /\.westgate-wiki-compose \.wiki-editor-image-resize__handle--nw\s*{[^}]*cursor:\s*nwse-resize/);
    assert.match(css, /\.westgate-wiki-compose \.wiki-editor-image-resize__handle--ne\s*{[^}]*cursor:\s*nesw-resize/);
    assert.match(css, /\.wiki-editor--resizing-image\s*{[^}]*user-select:\s*none/);
  });
});

await test("editor toolbar group labels stay visually subdued", function () {
  [editorCss, vendoredEditorCss].forEach(function (css) {
    assert.match(css, /\.wiki-editor-toolbar__group-label\s*{[^}]*font-size:\s*(?:0)?\.62rem/);
    assert.match(css, /\.wiki-editor-toolbar__group-label\s*{[^}]*font-weight:\s*600/);
    assert.match(css, /\.wiki-editor-toolbar__group-label\s*{[^}]*opacity:\s*(?:0)?\.62/);
  });
});

await test("editor toolbar labels do not force oversized group spacing", function () {
  [editorCss, vendoredEditorCss].forEach(function (css) {
    assert.match(css, /\.wiki-editor-toolbar\s*{[^}]*column-gap:\s*(?:0)?\.7rem/);
    assert.match(css, /\.wiki-editor-toolbar__group\s*{[^}]*flex-direction:\s*column/);
    assert.match(css, /\.wiki-editor-toolbar__group-controls\s*{[^}]*display:\s*flex/);
    assert.match(css, /\.wiki-editor-toolbar__separator\s*{[^}]*margin:\s*0/);
  });
});

await test("editor toolbar separators follow adjacent group rows", function () {
  assert.match(editorBundleSource, /previousGroup\.offsetTop\s*===\s*nextGroup\.offsetTop/);
  assert.doesNotMatch(editorBundleSource, /previousGroup\.offsetTop\s*===\s*separator\.offsetTop/);
});

await test("fullscreen source textarea captures Tab as source indentation", function () {
  assert.match(editorBundleSource, /sourceTextarea\.addEventListener\("keydown",\s*handleSourceKeydown\)/);
  assert.match(editorBundleSource, /event\.key\s*!==\s*"Tab"/);
  assert.match(editorBundleSource, /event\.preventDefault\(\)/);
  assert.match(editorBundleSource, /sourceTextarea\.setRangeText\("\\t"/);
  assert.match(vendoredEditorBundleSource, /addEventListener\("keydown"/);
  assert.match(vendoredEditorBundleSource, /setRangeText\("\\t"|setRangeText\("\t"/);
});

await test("styled span classes and styles round-trip through the extracted extension layer", function () {
  const editor = createEditor('<p><span class="legacy-accent" style="font-size: 1.2rem; color: #caa55a">Accent</span></p>');
  const rendered = editor.getHTML();

  assert.match(rendered, /<span class="legacy-accent" style="font-size: 1\.2rem; color: rgb\(202, 165, 90\);">Accent<\/span>/);
  editor.destroy();
});

await test("highlight colors render as sanitized multicolor marks", function () {
  const editor = createEditor("<p>Colored highlight</p>");

  editor.commands.setTextSelection({ from: 1, to: 8 });
  editor.commands.toggleHighlight({ color: "#bfdbfe" });
  const rendered = editor.getHTML();

  assert.match(rendered, /<mark[^>]*style="[^"]*background-color: rgb\(191, 219, 254\);[^"]*"[^>]*>Colored<\/mark>/);
  assert.match(rendered, /<mark[^>]*style="[^"]*color: rgb\(17, 24, 39\);[^"]*"[^>]*>Colored<\/mark>/);
  editor.destroy();
});

await test("highlight colors auto-select a legible foreground for custom dark backgrounds", function () {
  const editor = createEditor("<p>Custom highlight</p>");

  editor.commands.setTextSelection({ from: 1, to: 7 });
  editor.commands.toggleHighlight({ color: "#3b0764" });
  const rendered = editor.getHTML();

  assert.match(rendered, /<mark[^>]*style="[^"]*background-color: rgb\(59, 7, 100\);[^"]*"[^>]*>Custom<\/mark>/);
  assert.match(rendered, /<mark[^>]*style="[^"]*color: rgb\(249, 250, 251\);[^"]*"[^>]*>Custom<\/mark>/);
  editor.destroy();
});

await test("block background command applies and removes sanitized text block color styles", function () {
  const editor = createEditor('<p style="text-align: center">Block background</p>');

  editor.commands.setTextSelection(3);
  assert.equal(editor.commands.setWikiBlockBackground({ backgroundColor: "#dcfce7" }), true);
  assert.match(editor.getHTML(), /<p style="text-align: center; background-color: rgb\(220, 252, 231\); color: rgb\(17, 24, 39\);?">Block background<\/p>/);

  assert.equal(editor.commands.unsetWikiBlockBackground(), true);
  assert.match(editor.getHTML(), /<p style="text-align: center;">Block background<\/p>/);
  editor.destroy();
});

await test("block background command auto-selects a legible foreground for custom dark backgrounds", function () {
  const editor = createEditor("<p>Dark block</p>");

  editor.commands.setTextSelection(3);
  assert.equal(editor.commands.setWikiBlockBackground({ backgroundColor: "#111827" }), true);
  assert.match(editor.getHTML(), /<p style="background-color: rgb\(17, 24, 39\); color: rgb\(249, 250, 251\);?">Dark block<\/p>/);
  editor.destroy();
});

await test("editor color contrast helpers normalize custom hex colors and choose readable text", function () {
  assert.equal(normalizeHexColor("abc"), "#aabbcc");
  assert.equal(normalizeHexColor("#3B0764"), "#3b0764");
  assert.equal(normalizeHexColor("not-a-color"), "");
  assert.equal(getReadableTextColor("#3b0764"), "#f9fafb");
  assert.equal(getReadableTextColor("#fef08a"), "#111827");
});

await test("editor toolbar exposes highlight and text block background color palettes", function () {
  assert.match(editorBundleSource, /const HIGHLIGHT_COLOR_OPTIONS = \[/);
  assert.match(editorBundleSource, /label:\s*"Magenta"[\s\S]*backgroundColor:\s*"#f5d0fe"/);
  assert.match(editorBundleSource, /Highlight\.configure\(\{[\s\S]*multicolor:\s*true[\s\S]*\}\)/);
  assert.match(editorBundleSource, /getReadableTextColor\(backgroundColor\)/);
  assert.match(editorBundleSource, /normalizeHexColor\(customColor\.value\)/);
  assert.match(editorBundleSource, /toggleHighlight\(\{ color: backgroundColor, textColor \}\)/);
  assert.match(editorBundleSource, /const BLOCK_BACKGROUND_COLOR_OPTIONS = \[/);
  assert.match(editorBundleSource, /setWikiBlockBackground\(\{ backgroundColor, textColor \}\)/);
  assert.match(editorBundleSource, /unsetWikiBlockBackground\(\)/);
  assert.match(editorCss, /\.wiki-editor-color-menu\s*\{/);
  assert.match(editorCss, /\.wiki-editor-color-swatch\s*\{/);
  assert.match(editorCss, /\.wiki-editor-color-custom\s*\{/);
  assert.match(vendoredEditorCss, /\.wiki-editor-color-menu\s*\{/);
  assert.match(vendoredEditorCss, /\.wiki-editor-color-swatch\s*\{/);
  assert.match(vendoredEditorCss, /\.wiki-editor-color-custom\s*\{/);
});

await test("paragraph block backgrounds shrink to the text width in article and editor prose", function () {
  assert.match(articleBodyCss, /\.wiki-article-prose p\[style\*="background-color"\]\s*\{[^}]*display:\s*table/s);
  assert.match(articleBodyCss, /\.wiki-article-prose p\[style\*="background-color"\]\s*\{[^}]*width:\s*fit-content/s);
});

await test("table cell block backgrounds keep their paired foreground color", function () {
  const editor = createEditor("<table><tbody><tr><td><p>Cell background</p></td></tr></tbody></table>");

  editor.commands.setTextSelection(5);
  assert.equal(editor.commands.setWikiBlockBackground({ backgroundColor: "#dbeafe" }), true);
  assert.match(editor.getHTML(), /<td[^>]*style="background-color: rgb\(219, 234, 254\); color: rgb\(17, 24, 39\);"[^>]*><p>Cell background<\/p><\/td>/);
  assert.match(articleBodyCss, /\.wiki-article-prose :where\(td, th\)\[style\*="color"\] :where\(p, li\)\s*\{[^}]*color:\s*inherit/s);
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

await test("regular image can be converted into a plugin-owned image figure", function () {
  const editor = createEditor('<p><img src="/plain.png" alt="Plain" title="Plain title" width="320" class="wiki-image-align-right wiki-image-size-md"></p>');
  const image = editor.view.dom.querySelector("img");
  const selectionPos = editor.view.posAtDOM(image, 0);

  editor.chain().focus().setNodeSelection(selectionPos).convertImageToFigure().run();
  const rendered = editor.getHTML();

  assert.match(rendered, /<figure class="image image-style-align-right wiki-image-size-md" data-wiki-node="image-figure">/);
  assert.match(rendered, /<img src="\/plain\.png" alt="Plain" title="Plain title" width="320">/);
  assert.match(rendered, /<figcaption><p><\/p><\/figcaption>/);
  assert.doesNotMatch(rendered, /<p><figure/);
  assert.equal(editor.state.selection.$from.parent.type.name, "paragraph");
  assert.equal(editor.state.selection.$from.node(editor.state.selection.$from.depth - 1).type.name, "imageFigure");
  editor.destroy();
});

await test("selected image width updates as a bounded resize attribute", function () {
  const editor = createEditor('<p><img src="/plain.png" alt="Plain" width="320" class="wiki-image-size-md"></p>');
  const image = editor.view.dom.querySelector("img");
  const selectionPos = editor.view.posAtDOM(image, 0);

  editor.chain().focus().setNodeSelection(selectionPos).run();
  assert.equal(calculateResizedImageWidth({ startWidth: 320, deltaX: 90, directionX: 1, minWidth: 96, maxWidth: 380 }), 380);
  assert.equal(setSelectedImageWidth(editor, 380), true);

  const rendered = editor.getHTML();
  assert.match(rendered, /<img[^>]*src="\/plain\.png"[^>]*>/);
  assert.match(rendered, /<img[^>]*width="380"[^>]*>/);
  assert.doesNotMatch(rendered, /wiki-image-size-md/);
  editor.destroy();
});

await test("selected image figure width updates through the same resize contract", function () {
  const editor = createEditor('<figure class="image wiki-image-size-lg"><img src="/figure.png" alt="Figure" width="420"><figcaption><p>Caption</p></figcaption></figure>');
  const figure = editor.view.dom.querySelector("figure.image");
  const selectionPos = editor.view.posAtDOM(figure, 0);

  editor.chain().focus().setNodeSelection(selectionPos).run();
  assert.equal(setSelectedImageWidth(editor, 260), true);

  const rendered = editor.getHTML();
  assert.match(rendered, /<figure class="image" data-wiki-node="image-figure">/);
  assert.match(rendered, /<img src="\/figure\.png" alt="Figure" width="260">/);
  assert.doesNotMatch(rendered, /wiki-image-size-lg/);
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

  assert.match(rendered, /<span class="wiki-editor-link wiki-external-link" data-wiki-link-href="https:\/\/google\.com"/);
  assert.match(rendered, /data-wiki-link-target="_blank"/);
  assert.match(rendered, /data-wiki-link-rel="noopener noreferrer"/);
  assert.doesNotMatch(rendered, /<a\b[^>]*href="https:\/\/google\.com"/);
  editor.commands.setTextSelection(5);
  assert.equal(editor.getAttributes("link").href, "https://google.com");

  editor.destroy();
});

await test("wiki entity marks and nodes round-trip as inert editor spans", function () {
  const editor = createEditor('<p>See <span class="wiki-entity wiki-entity--page" data-wiki-entity="page" data-wiki-target="Guides/Map Creation Guide" data-wiki-label="Map guide">Map guide</span>, <span class="wiki-entity wiki-entity--namespace" data-wiki-entity="namespace" data-wiki-target="Guides">Guides</span>, <span class="wiki-entity wiki-entity--user" data-wiki-entity="user" data-wiki-username="xtul" data-wiki-userslug="xtul">@xtul</span>, and <span class="wiki-entity wiki-entity--footnote" data-wiki-entity="footnote" data-wiki-footnote="Important note">[note]</span>.</p>');
  const rendered = editor.getHTML();

  assert.match(rendered, /data-wiki-entity="page"/);
  assert.match(rendered, /data-wiki-target="Guides\/Map Creation Guide"/);
  assert.match(rendered, /data-wiki-entity="namespace"/);
  assert.match(rendered, /data-wiki-entity="user"/);
  assert.match(rendered, /data-wiki-entity="footnote"/);
  assert.match(rendered, /data-wiki-footnote-b64="/);
  assert.doesNotMatch(rendered, /data-wiki-footnote="Important note"/);
  assert.doesNotMatch(rendered, /<a\b/);

  editor.destroy();
});

await test("wiki entity insert commands create page, namespace, user, and footnote entities", function () {
  const editor = createEditor("<p>Start</p>");

  editor.commands.insertWikiPageLink({ target: "Guides/Map Creation Guide", label: "Map guide" });
  editor.commands.insertContent(" ");
  editor.commands.insertWikiNamespaceLink({ target: "Guides", label: "Guides" });
  editor.commands.insertContent(" ");
  editor.commands.insertWikiUserMention({ username: "xtul", userslug: "xtul", uid: "1" });
  editor.commands.insertContent(" ");
  editor.commands.insertWikiFootnote({ body: "Important note" });

  const rendered = editor.getHTML();
  assert.match(rendered, /data-wiki-entity="page"[^>]*>Map guide<\/span>/);
  assert.match(rendered, /data-wiki-entity="namespace"[^>]*>Guides<\/span>/);
  assert.match(rendered, /data-wiki-entity="user"[^>]*>@xtul<\/span>/);
  assert.match(rendered, /wiki-entity--user-good/);
  assert.match(rendered, /spellcheck="false"/);
  assert.match(rendered, /data-wiki-entity="footnote"[^>]*data-wiki-footnote-b64="[^"]+"[^>]*>\[note\]<\/span>/);

  editor.destroy();
});

await test("page link dialog can discover and insert namespace autocomplete results", function () {
  assert.doesNotMatch(
    editorBundleSource,
    /params\.set\("scope",\s*type === "namespace" \? "all-wiki" : "current-namespace"\)/
  );
  assert.doesNotMatch(
    editorBundleSource,
    /params\.set\("type",\s*type === "namespace" \? "namespace" : "page"\)/
  );
  assert.match(
    editorBundleSource,
    /if \(type === "page"\) \{[\s\S]*selected && selected\.type === "namespace"[\s\S]*insertWikiNamespaceLink/
  );
  assert.match(
    vendoredEditorBundleSource,
    /==="page"[\s\S]*\.type==="namespace"[\s\S]*insertWikiNamespaceLink/
  );
});

await test("typed wiki user mentions render as unresolved until autocomplete confirms them", function () {
  const editor = createEditor("<p>Start</p>");

  editor.commands.insertWikiUserMention({ username: "missing", resolved: false });

  const rendered = editor.getHTML();
  assert.match(rendered, /data-wiki-entity="user"[^>]*>@missing<\/span>/);
  assert.match(rendered, /data-wiki-resolved="0"/);
  assert.match(rendered, /wiki-entity--user-bad/);

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

await test("wikiCallout unset command unwraps the selected callout content", function () {
  const editor = createEditor('<aside class="wiki-callout wiki-callout--warning" data-callout-type="warning" data-callout-title="Compatibility"><p><strong>Compatibility</strong></p><p>Test custom CSS.</p></aside>');

  editor.commands.setTextSelection(18);
  assert.equal(editor.commands.unsetWikiCallout(), true);
  const rendered = editor.getHTML();

  assert.doesNotMatch(rendered, /wiki-callout/);
  assert.match(rendered, /<p><strong>Compatibility<\/strong><\/p>/);
  assert.match(rendered, /<p>Test custom CSS\.<\/p>/);
  editor.destroy();
});

await test("wikiCallout Backspace shortcut unwraps a callout from an empty paragraph", function () {
  const editor = createEditor('<aside class="wiki-callout wiki-callout--warning" data-callout-type="warning" data-callout-title="Compatibility"><p><strong>Compatibility</strong></p><p></p></aside>');

  editor.commands.setTextSelection(17);
  editor.commands.keyboardShortcut("Backspace");
  const rendered = editor.getHTML();

  assert.doesNotMatch(rendered, /wiki-callout/);
  assert.match(rendered, /<p><strong>Compatibility<\/strong><\/p>/);
  editor.destroy();
});

await test("Backspace after a list removes the trailing empty paragraph instead of creating extra gaps", function () {
  const editor = createEditor("<ul><li><p>Forums</p></li><li><p>Discord Server</p></li></ul><p></p>");

  editor.commands.setTextSelection(editor.state.doc.content.size - 1);
  for (let i = 0; i < 5; i += 1) {
    editor.commands.keyboardShortcut("Backspace");
  }
  const rendered = editor.getHTML();

  assert.equal(rendered, "<ul><li><p>Forums</p></li><li><p>Discord Server</p></li></ul><p></p>");
  assert.doesNotMatch(rendered, /<li><p>Discord Server<\/p><p><\/p><\/li>/);
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

await test("wiki code block preserves only supported syntax language classes", function () {
  const editor = createEditor([
    '<pre><code class="language-bash">echo "$HOME"</code></pre>',
    '<pre><code class="language-javascript">console.log("nope")</code></pre>'
  ].join(""));

  const json = editor.getJSON();
  assert.equal(json.content[0].attrs.language, "bash");
  assert.equal(json.content[1].attrs.language, null);

  const rendered = editor.getHTML();
  assert.match(rendered, /<code class="language-bash">echo "\$HOME"<\/code>/);
  assert.doesNotMatch(rendered, /language-javascript/);
  editor.destroy();
});

await test("wiki code block language command updates the active code block", function () {
  const editor = createEditor('<pre><code>Get-ChildItem</code></pre>');

  editor.commands.setTextSelection(3);
  assert.equal(editor.commands.setCodeBlockLanguage("powershell"), true);
  assert.equal(editor.getJSON().content[0].attrs.language, "powershell");
  assert.match(editor.getHTML(), /<code class="language-powershell">Get-ChildItem<\/code>/);

  assert.equal(editor.commands.setCodeBlockLanguage("c#"), true);
  assert.equal(editor.getJSON().content[0].attrs.language, "csharp");
  assert.match(editor.getHTML(), /<code class="language-csharp">Get-ChildItem<\/code>/);

  assert.equal(editor.commands.setCodeBlockLanguage("javascript"), true);
  assert.equal(editor.getJSON().content[0].attrs.language, null);
  assert.doesNotMatch(editor.getHTML(), /language-javascript|language-csharp/);
  editor.destroy();
});

await test("wiki code block language applies editor syntax token decorations", function () {
  const editor = createEditor('<pre><code class="language-csharp">public static void Main() { return 0; }</code></pre>');

  assert.equal(editor.view.dom.querySelectorAll(".wiki-code-token--keyword").length >= 4, true);
  assert.equal(editor.view.dom.querySelectorAll(".wiki-code-token--number").length, 1);
  assert.match(editor.getHTML(), /<code class="language-csharp">public static void Main\(\) \{ return 0; \}<\/code>/);
  assert.doesNotMatch(editor.getHTML(), /wiki-code-token/);
  editor.destroy();
});

await test("wiki code block syntax highlighting avoids selection-only rebuilds", function () {
  const wikiCodeBlockSource = readFileSync(new URL("../tiptap/src/extensions/wiki-code-block.mjs", import.meta.url), "utf8");

  assert.match(wikiCodeBlockSource, /function\s+transactionTouchesCodeBlock\s*\(/);
  assert.match(wikiCodeBlockSource, /if\s*\(\s*!transaction\.docChanged\s*\|\|\s*!transactionTouchesCodeBlock/);
  assert.doesNotMatch(wikiCodeBlockSource, /transaction\.selectionSet/);
});

await test("read-only wiki pages apply syntax token highlighting to language code blocks", function () {
  assert.match(wikiJsSource, /function\s+highlightReadOnlyWikiCodeBlocks\s*\(/);
  assert.match(wikiJsSource, /wiki-code-token wiki-code-token--/);
  assert.match(wikiJsSource, /querySelectorAll\('\.wiki-article-prose pre code\[class\*="language-"\]'\)/);
  assert.match(wikiJsSource, /highlightReadOnlyWikiCodeBlocks\(\)/);
  assert.match(articleBodyCss, /\.wiki-article-prose\s+pre\s+code\s+\.wiki-code-token--keyword/);
});

await test("top toolbar schema excludes contextual image layout and size controls", function () {
  IMAGE_CONTEXT_BUTTON_IDS.forEach(function (id) {
    assert.equal(TOP_TOOLBAR_BUTTON_IDS.includes(id), false);
  });

  assert.equal(TOP_TOOLBAR_BUTTON_IDS.includes("image-upload"), true);
  assert.equal(IMAGE_CONTEXT_BUTTON_IDS.includes("image-size-md"), true);
  assert.equal(IMAGE_CONTEXT_BUTTON_IDS.includes("image-align-right"), true);
  assert.equal(IMAGE_CONTEXT_BUTTON_IDS.includes("image-convert-figure"), true);
});

await test("top toolbar schema keeps wiki entity tools and only table creation in the always-visible toolbar", function () {
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
    "tables",
    "view"
  ]);

  const history = TOP_TOOLBAR_GROUPS.find(function (group) { return group.id === "history"; });
  const media = TOP_TOOLBAR_GROUPS.find(function (group) { return group.id === "links-media"; });
  const tables = TOP_TOOLBAR_GROUPS.find(function (group) { return group.id === "tables"; });
  const view = TOP_TOOLBAR_GROUPS.find(function (group) { return group.id === "view"; });

  assert.deepEqual(history.buttonIds, ["undo", "redo"]);
  assert.deepEqual(media.buttonIds, ["link", "wiki-page-link", "wiki-user-mention", "wiki-footnote", "image-upload", "media-row-2", "media-row-3"]);
  assert.equal(TOP_TOOLBAR_BUTTON_IDS.includes("wiki-namespace-link"), false);
  assert.deepEqual(tables.buttonIds, ["table-insert"]);
  assert.deepEqual(view.buttonIds, ["fullscreen-source"]);
  assert.equal(TOP_TOOLBAR_BUTTON_IDS.includes("fullscreen-source"), true);
});

await test("fullscreen source mode has guarded editable source synchronization", function () {
  assert.match(editorBundleSource, /function\s+escapeSourceHtml\s*\(/);
  assert.match(editorBundleSource, /function\s+formatSourceHtml\s*\(/);
  assert.match(editorBundleSource, /function\s+normalizeSourceHtmlForEditor\s*\(/);
  assert.match(editorBundleSource, /function\s+removeSourceWhitespaceTextNodes\s*\(/);
  assert.match(editorBundleSource, /function\s+plainSourceHeadingText\s*\(/);
  assert.match(editorBundleSource, /function\s+scrollSourceToHeading\s*\(/);
  assert.match(editorBundleSource, /function\s+highlightSourceHtml\s*\(/);
  assert.match(editorBundleSource, /function\s+createFullscreenSourceMode\s*\(/);
  assert.match(editorBundleSource, /data-wiki-editor-source-wrap/);
  assert.match(editorBundleSource, /const\s+sourceWrap\s*=\s*sourcePanel\.querySelector\("\[data-wiki-editor-source-wrap\]"\)/);
  assert.match(editorBundleSource, /let\s+sourceWrapEnabled\s*=\s*false/);
  assert.match(editorBundleSource, /function\s+setSourceWrap\s*\(/);
  assert.match(editorBundleSource, /sourcePanel\.classList\.toggle\("wiki-editor__fullscreen-source-panel--wrap",\s*sourceWrapEnabled\)/);
  assert.match(editorBundleSource, /sourceTextarea\.setAttribute\("wrap",\s*sourceWrapEnabled\s*\?\s*"soft"\s*:\s*"off"\)/);
  assert.match(editorBundleSource, /sourceWrap\.addEventListener\("click",\s*function \(\) \{[\s\S]*setSourceWrap\(!sourceWrapEnabled\)/);
  assert.match(editorBundleSource, /let\s+syncingSource\s*=\s*false/);
  assert.match(editorBundleSource, /let\s+sourceDirty\s*=\s*false/);
  assert.match(editorBundleSource, /SOURCE_SYNC_DELAY_MS\s*=\s*500/);
  assert.match(editorBundleSource, /function\s+scheduleSourceFromEditor\s*\(/);
  assert.match(editorBundleSource, /window\.setTimeout\(function \(\) \{[\s\S]*syncSourceFromEditor\(\);[\s\S]*\},\s*SOURCE_SYNC_DELAY_MS\)/);
  assert.match(editorBundleSource, /syncingSource\s*\|\|\s*sourceDirty\s*\|\|\s*!fullscreen\s*\|\|\s*sourceHidden/);
  assert.match(editorBundleSource, /new DOMParser\(\)\.parseFromString/);
  assert.match(editorBundleSource, /sourceTextarea\.value\s*=\s*formatSourceHtml\(sanitizeHtml\(editor\.getHTML\(\)\)\)/);
  assert.match(editorBundleSource, /normalizeSourceHtmlForEditor\(sourceTextarea\.value\)/);
  assert.match(editorBundleSource, /function\s+applySourceToEditor\s*\(/);
  assert.match(editorBundleSource, /editor\.commands\.setContent\([^,]+,\s*false\)/);
  assert.match(editorBundleSource, /sourceApply\.addEventListener\("click",\s*applySourceToEditor\)/);
  assert.match(editorBundleSource, /sourceTextarea\.addEventListener\("input",\s*function \(\) \{[\s\S]*setSourceDirty\(true\)/);
  assert.match(editorBundleSource, /sourceTextarea\.addEventListener\("input",\s*function \(\) \{[\s\S]*renderSourceHighlight\(\)/);
  assert.doesNotMatch(editorBundleSource, /sourceTextarea\.addEventListener\("input",\s*function \(\) \{[\s\S]*syncEditorFromSource\(\)/);
  assert.match(editorBundleSource, /editor\.on\("update",\s*scheduleSourceFromEditor\)/);
  assert.doesNotMatch(editorBundleSource, /editor\.on\("update",\s*syncSourceFromEditor\)/);
  assert.match(editorBundleSource, /root\.addEventListener\("wiki-editor-toc-navigate",\s*handleTocNavigate\)/);
  assert.match(editorBundleSource, /root\.removeEventListener\("wiki-editor-toc-navigate",\s*handleTocNavigate\)/);
  assert.match(editorBundleSource, /sourceTextarea\.scrollTo\(\{[\s\S]*behavior:\s*"smooth"/);
});

await test("editor ToC updates are debounced and avoid transaction-only DOM rewrites", function () {
  assert.match(editorBundleSource, /function\s+scheduleTocSync\s*\(/);
  assert.match(editorBundleSource, /window\.setTimeout\(syncToc,\s*250\)/);
  assert.match(editorBundleSource, /signature\s*===\s*lastTocSignature/);
  assert.doesNotMatch(editorBundleSource, /editor\.on\("transaction",\s*syncToc\)/);
});

await test("editor ToC navigation dispatches a source sync event", function () {
  assert.match(editorBundleSource, /new CustomEvent\("wiki-editor-toc-navigate"/);
  assert.match(editorBundleSource, /detail:\s*\{\s*item/);
  assert.match(editorBundleSource, /bubbles:\s*true/);
});

await test("fullscreen source toolbar action is bridged onto the toolbar mount", function () {
  assert.match(editorBundleSource, /toolbarMount\.__wikiToggleFullscreenSource\s*=/);
  assert.match(editorBundleSource, /toolbarMount\.__wikiIsFullscreenSourceActive\s*=/);
});

await test("code block syntax dropdown is contextual to active code blocks", function () {
  assert.match(editorBundleSource, /function\s+createCodeBlockLanguageToolbar\s*\(/);
  assert.match(editorBundleSource, /wiki-editor-code-language-tools/);
  assert.match(editorBundleSource, /setCodeBlockLanguage\(select\.value\)/);
  assert.match(editorBundleSource, /editor\.isActive\("codeBlock"\)/);
});

await test("fullscreen source mode portals above NodeBB page stacking contexts", function () {
  assert.match(editorBundleSource, /wiki-editor-fullscreen-portal/);
  assert.match(editorBundleSource, /wiki-editor-fullscreen-actions-portal/);
  assert.match(editorBundleSource, /querySelector\("\.wiki-compose-actions--floating"\)/);
  assert.match(editorBundleSource, /document\.body\.appendChild\(portalHost\)/);
  assert.match(editorBundleSource, /document\.body\.appendChild\(actionsPortalHost\)/);
  assert.match(editorBundleSource, /placeholder\.parentNode\.insertBefore\(root,\s*placeholder\)/);
  assert.match(editorBundleSource, /actionsPlaceholder\.parentNode\.insertBefore\(actionsDock,\s*actionsPlaceholder\)/);
});

await test("fullscreen source highlighting escapes raw source before adding syntax spans", function () {
  assert.match(editorBundleSource, /escapeSourceHtml\(source\)/);
  assert.match(editorBundleSource, /\.replace\(/);
  assert.match(editorBundleSource, /wiki-editor-source-token--tag/);
  assert.match(editorBundleSource, /wiki-editor-source-token--script/);
});

await test("fullscreen source mode css supports resize and source hiding", function () {
  [editorCss, vendoredEditorCss].forEach(function (css) {
    assert.match(css, /\.wiki-editor-fullscreen-portal\s*{[^}]*z-index:\s*1040/);
    assert.match(css, /\.wiki-editor-fullscreen-actions-portal\s*{[^}]*z-index:\s*1065/);
    assert.match(css, /\.wiki-editor-fullscreen-actions-portal\s*>\s*\.wiki-compose-actions--floating\s*{[^}]*pointer-events:\s*auto/);
    assert.match(css, /\.wiki-editor--fullscreen-source\s*{[^}]*z-index:\s*1040/);
    assert.match(css, /\.wiki-editor--fullscreen-source\s*{[^}]*background:\s*var\(--bs-body-bg,\s*#fff\)/);
    assert.match(css, /\.wiki-editor--fullscreen-source\s+\.wiki-editor__fullscreen-editor-panel[^{}]*{[^}]*background:\s*var\(--bs-body-bg,\s*#fff\)/);
    assert.match(css, /\.wiki-editor--fullscreen-source\s+\.wiki-editor__surface[^{}]*{[^}]*background:\s*var\(--bs-body-bg,\s*#fff\)/);
    assert.match(css, /\.wiki-editor-fullscreen-source-active\s+\.wiki-compose-actions--floating\s*{[^}]*z-index:\s*1060/);
    assert.match(css, /\.wiki-editor-fullscreen-source-active\s+\.wiki-compose-actions--floating\s*{[^}]*right:\s*max\(1rem,\s*env\(safe-area-inset-right,\s*0px\)\)/);
    assert.match(css, /\.wiki-editor-fullscreen-source-active\s+\.wiki-compose-actions--floating\s*{[^}]*justify-content:\s*flex-end/);
    assert.match(css, /\.wiki-editor--fullscreen-source\s+\.wiki-editor-toc\s*{[^}]*right:\s*0/);
    assert.match(css, /\.wiki-editor--fullscreen-source\s+\.wiki-editor-toc\s*{[^}]*transform:\s*translate(?:X)?\(calc\(100%\s*-\s*2\.6rem\)\)/);
    assert.match(css, /--wiki-editor-source-panel-width:\s*clamp\(22rem,\s*38vw,\s*70vw\)/);
    assert.match(css, /\.wiki-editor__fullscreen-layout\s*{[^}]*grid-template-columns:\s*var\(--wiki-editor-source-panel-current-width/);
    assert.match(css, /\.wiki-editor--fullscreen-source-hidden\s+\.wiki-editor__fullscreen-source-panel[^{}]*{[^}]*display:\s*none/);
    assert.match(css, /\.wiki-editor--fullscreen-source-hidden\s+\.wiki-editor__fullscreen-layout\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    assert.match(css, /\.wiki-editor__fullscreen-resizer\s*{[^}]*cursor:\s*col-resize/);
    assert.match(css, /\.wiki-editor__fullscreen-source-actions\s*{[^}]*display:\s*flex/);
    assert.match(css, /\.wiki-editor__fullscreen-source-toggle,\s*\.westgate-wiki-compose\s+\.wiki-editor__fullscreen-source-wrap\s*{[^}]*width:\s*2rem/);
    assert.match(css, /\.wiki-editor__fullscreen-source-panel--wrap\s+\.wiki-editor__fullscreen-source-highlight,\s*\.westgate-wiki-compose\s+\.wiki-editor__fullscreen-source-panel--wrap\s+\.wiki-editor__fullscreen-source-input\s*{[^}]*white-space:\s*pre-wrap/);
    assert.match(css, /\.wiki-editor__fullscreen-source-panel--wrap\s+\.wiki-editor__fullscreen-source-highlight,\s*\.westgate-wiki-compose\s+\.wiki-editor__fullscreen-source-panel--wrap\s+\.wiki-editor__fullscreen-source-input\s*{[^}]*overflow-wrap:\s*break-word/);
    assert.doesNotMatch(css, /\.wiki-editor__fullscreen-source-panel--dirty\s+\.wiki-editor__fullscreen-source-highlight\s*{[^}]*visibility:\s*hidden/);
    assert.doesNotMatch(css, /\.wiki-editor__fullscreen-source-panel--dirty\s+\.wiki-editor__fullscreen-source-input\s*{[^}]*color:\s*#f9fafb/);
  });
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
