# CKEditor To Tiptap Transition Contract

## Purpose

This document is the execution contract for replacing the Westgate Wiki compose
editor with Tiptap. The goal is Tiptap as the primary wiki editor. CKEditor may
remain temporarily available as a controlled fallback while the migration is
being live-hardened, but new feature work should target Tiptap rather than grow
two editors in parallel.

The current wiki content model stays intact:

- NodeBB topics are wiki pages.
- The first post is the canonical article body.
- Wiki compose/create/edit flows continue to use NodeBB topic and post APIs.
- Wiki rendering, internal links, mentions, footnotes, watch notifications,
  path validation, and discussion controls remain plugin-owned behavior.

The editor implementation changes from a vendored CKEditor 5 bundle to an
open-source Tiptap/ProseMirror bundle with plugin-owned UI.

## Current State To Replace

The CKEditor integration currently consists of:

- `ckeditor/src/wiki-editor-bundle.js`
  - Builds a global `WikiEditorBundle`.
  - Creates the CKEditor instance.
  - Imports Markdown to HTML with `markdown-it`.
  - Contains upload adapter logic for `POST /api/post/upload`.
  - Contains CKEditor-specific body-wrapper cleanup and powered-by handling.
- `ckeditor/vite.config.mjs`
  - Builds `public/vendor/ckeditor5/wiki-ckeditor.bundle.js`.
  - Builds `public/vendor/ckeditor5/wiki-ckeditor.css`.
- `lib/compose-assets.js`
  - Serves `/westgate-wiki/compose/vendor.js` and `vendor.css` from the
    CKEditor vendor directory.
- `public/wiki-compose-page.js`
  - Waits for `WikiEditorBundle`.
  - Creates/destroys the rich editor.
  - Imports Markdown into the editor.
  - Inserts internal wiki-link text.
  - Saves HTML through NodeBB APIs.
- `templates/wiki-compose.tpl`
  - Loads `vendor.css`, `article-body.css`, `vendor.js`, and `page.js`.
  - Provides the editor mount point `#wiki-compose-editor`.
- `public/wiki-article-body.css`
  - Contains article prose rules plus CKEditor UI rules and variables.
- `README.md`, `THIRD_PARTY_NOTICES.md`, `AGENTS.md`, and `package.json`
  - Document and build CKEditor.

The migration must remove or rename CKEditor-specific concepts in all of these
places before the work is considered complete.

## Non-Negotiable Direction

1. CKEditor is deprecated and must not remain the primary editor.
2. Tiptap is the default wiki compose editor after the migration.
3. CKEditor may remain available only as an explicit fallback until live
   verification proves the migration safe for expected wiki content.
4. The plugin uses open-source packages only. Do not use Tiptap Pro UI,
   comments, AI, collaboration, or cloud conversion services.
5. The stored NodeBB post body remains HTML for the first migration release.
6. Tiptap JSON may be captured as a derived/debug/export format later, but it
   must not become the primary stored format until all NodeBB rendering/search
   impacts are deliberately handled.
7. The wiki path resolver, page title validation, permissions, redlinks,
   mention processing, footnotes, and parser hooks remain authoritative.
8. Client code and templates must not hand-build wiki paths. Link insertion
   must continue to use `lib/wiki-link-autocomplete.js` through the existing
   API.

## Architecture Decision Record

### ADR-001: Canonical Storage Format

Decision: Keep canonical storage as sanitized HTML in the first Tiptap release.

Reasons:

- Existing wiki pages are already stored as HTML in the NodeBB first post.
- `lib/wiki-html-parse.js` already detects wiki-stored HTML and prevents the
  normal Markdown parse pipeline from mangling it.
- Existing server-side wiki transforms operate on parsed/rendered HTML and are
  already tested.
- NodeBB topic/post APIs can continue to receive `content` without schema
  changes.
- Migration risk is lower than introducing a new JSON storage side channel.

Consequence:

- Tiptap JSON is the editor's internal document model.
- Save uses `editor.getHTML()`, then client and server validation/sanitization.
- Markdown import/export is supported as an authoring feature, not the canonical
  database format.

Future option:

- Add optional `postData.westgateWikiDocJson` metadata only after proving that
  NodeBB search, diffs, backups, API consumers, and old article rendering remain
  acceptable without relying on raw post HTML.

### ADR-002: Markdown Policy

Decision: Markdown is an import/export interchange format, not the source of
truth.

Required behavior:

- Markdown import converts Markdown to Tiptap content.
- Markdown export serializes the current Tiptap document to Markdown for user
  copying or future tooling.
- Round-trip support is best-effort:
  `Markdown -> Tiptap JSON -> sanitized HTML -> Tiptap JSON -> Markdown`.

Known limitation:

- Exact Markdown fidelity is impossible for all HTML, tables, custom blocks,
  image attributes, embeds, and classed elements.
- The contract is semantic preservation, not byte-for-byte Markdown stability.

### ADR-003: Sanitization Boundary

Decision: Sanitize on the client for UX feedback and on the server for trust.

Client sanitization is useful for immediate warnings and preview consistency.
Server sanitization is mandatory because browser clients are untrusted.

Server-side save validation must reject or clean unsafe HTML before NodeBB saves
wiki main-post content.

### ADR-004: Editor UI Ownership

Decision: Build a plugin-owned Tiptap UI using vanilla JavaScript and CSS.

Reasons:

- NodeBB plugin pages here are not React/Vue apps.
- Tiptap core is headless and framework-agnostic.
- A plain JS bundle fits the current Vite/static asset model.
- Avoiding Pro UI keeps licensing and maintenance simple.

## Target Package Set

Use the smallest package set that covers the required editor surface.

Core:

- `@tiptap/core`
- `@tiptap/starter-kit`
- `@tiptap/pm`

Recommended open-source extensions:

- `@tiptap/extension-link`
- `@tiptap/extension-image`
- `@tiptap/extension-table`
- `@tiptap/extension-table-row`
- `@tiptap/extension-table-header`
- `@tiptap/extension-table-cell`
- `@tiptap/extension-task-list`
- `@tiptap/extension-task-item`
- `@tiptap/extension-placeholder`
- `@tiptap/extension-character-count`
- `@tiptap/extension-typography`
- `@tiptap/extension-underline`
- `@tiptap/extension-subscript`
- `@tiptap/extension-superscript`
- `@tiptap/extension-text-align`

Markdown:

- Prefer `@tiptap/markdown` if the installed Tiptap version provides the needed
  open-source API (`contentType: "markdown"`, `getMarkdown()`,
  `setContent(..., { contentType: "markdown" })`).
- If `@tiptap/markdown` is not suitable in practice, use a plugin-owned
  adapter built on `markdown-it` for import and `turndown` for export during
  the transition. This is acceptable because those packages already exist in
  the project.

Sanitization:

- Browser: `dompurify`.
- Node.js: either `isomorphic-dompurify` with `jsdom`, or `sanitize-html`.
- Prefer `sanitize-html` server-side if bundle/runtime size and NodeBB startup
  simplicity matter more than exact DOMPurify parity.

Optional code highlighting:

- Add lowlight/highlight integration only if code-block language highlighting
  is a product requirement. Plain fenced code blocks are enough for the first
  release.

Do not add:

- `@tiptap-pro/*`
- Tiptap cloud conversion APIs
- Collaboration, comments, AI, or paid templates

## Desired Runtime Architecture

Textual diagram:

```text
wiki-compose.tpl
  -> /westgate-wiki/compose/editor.css
  -> /westgate-wiki/compose/editor.js
  -> public/wiki-compose-page.js
       -> window.WestgateWikiEditor.createWikiEditor(...)
       -> editor.getHTML()
       -> client sanitize / size check / title check
       -> POST /api/v3/topics or PUT /api/v3/posts/:pid
            -> filter:topic.post / filter:topic.edit
            -> server sanitize wiki main post HTML
            -> page title/path/body validation
            -> NodeBB database
wiki article render
  -> NodeBB parse pipeline
  -> lib/wiki-html-parse.js suppresses Markdown parse for stored HTML
  -> filter:parse.post wiki transforms
  -> templates/wiki-page.tpl + public/wiki-article-body.css
```

Editor bundle public API:

```js
window.WestgateWikiEditor = {
  createWikiEditor(element, options) -> Promise<WikiEditorHandle>,
  markdownToHtml(markdown) -> string,
  htmlToMarkdown(html) -> string,
  sanitizeHtml(html) -> string
}
```

Editor handle contract:

```js
{
  getHTML() -> string,
  getJSON() -> object,
  getMarkdown() -> string,
  setHTML(html) -> void,
  setMarkdown(markdown) -> void,
  insertWikiLink(insertText) -> void,
  focus() -> void,
  destroy() -> Promise<void> | void
}
```

Keep `public/wiki-compose-page.js` coupled to this small handle contract, not to
Tiptap internals.

## Content Schema Requirements

Minimum supported Tiptap nodes/marks:

- Document
- Paragraph
- Text
- Heading levels 1-4
- Bullet list
- Ordered list
- Task list / task item
- Blockquote
- Code block
- Horizontal rule
- Hard break
- Table, row, header, cell
- Image
- Link
- Bold, italic, underline, strike, code
- Subscript, superscript
- Text alignment where already supported by current authoring expectations

Custom wiki nodes:

- `wikiCallout`
  - attrs: `type` (`info`, `warning`, `danger`, `success`, `note`), optional
    `title`
  - HTML: `<aside class="wiki-callout wiki-callout--TYPE" data-callout-type="TYPE">`
  - Markdown fallback: blockquote with marker, for example
    `> [!warning] Title`
- `wikiInternalLink` is not required as a separate node in release one.
  Continue inserting literal `[[Page]]` text for internal wiki links so the
  existing server-side resolver remains authoritative.
- Future option: a mark/node that renders to `[[...]]` on save and displays as
  a chip in the editor. Do not block CKEditor removal on this.

Example Tiptap JSON:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 2 },
      "content": [{ "type": "text", "text": "Overview" }]
    },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "See " },
        { "type": "text", "text": "[[Map Creation Guide]]" },
        { "type": "text", "text": " for details." }
      ]
    },
    {
      "type": "wikiCallout",
      "attrs": { "type": "warning", "title": "Compatibility" },
      "content": [
        {
          "type": "paragraph",
          "content": [{ "type": "text", "text": "Test custom CSS in game clients." }]
        }
      ]
    }
  ]
}
```

Saved HTML target:

```html
<h2>Overview</h2>
<p>See [[Map Creation Guide]] for details.</p>
<aside class="wiki-callout wiki-callout--warning" data-callout-type="warning">
  <p><strong>Compatibility</strong></p>
  <p>Test custom CSS in game clients.</p>
</aside>
```

## Sanitization Contract

Allowed tags:

- Text blocks: `p`, `h1`, `h2`, `h3`, `h4`, `blockquote`, `pre`, `code`
- Inline: `strong`, `em`, `u`, `s`, `sub`, `sup`, `span`, `br`, `a`
- Lists: `ul`, `ol`, `li`
- Tables: `table`, `thead`, `tbody`, `tr`, `th`, `td`, `caption`, `colgroup`,
  `col`
- Media: `figure`, `figcaption`, `img`
- Wiki blocks: `aside`, `div`
- Utility: `hr`

Allowed attributes:

- Global: `class`, `data-*`, `aria-*`
- Links: `href`, `title`, `rel`, `target`
- Images: `src`, `alt`, `title`, `width`, `height`
- Tables: `colspan`, `rowspan`
- Code: `data-language`, `class` only for whitelisted language classes

URL rules:

- Allow `http:`, `https:`, root-relative `/...`, same-page anchors `#...`, and
  safe relative wiki/forum paths.
- Reject `javascript:`, `data:` except optionally image data during paste before
  upload, `vbscript:`, and protocol-relative URLs unless normalized.
- Image `src` should be upload-backed URLs after save. Do not persist base64
  images in release one.

Class rules:

- Allow plugin classes only when they match one of:
  - `wiki-*`
  - `language-*`
  - `hljs*` only if syntax highlighting is enabled
  - Tiptap/table alignment classes explicitly emitted by our extensions
- Drop arbitrary user-supplied classes.

Style rules:

- Default: strip all inline `style`.
- Exception: allow no inline styles in release one.
- If alignment is required, serialize alignment as whitelisted classes or
  `data-align`, then render with CSS.

Server enforcement:

- Add `lib/wiki-content-sanitize.js`.
- Use it from `filter:topic.post` and `filter:topic.edit` before body size
  validation where possible.
- Only sanitize first-post content for topics inside effective wiki namespaces.
- Preserve existing error behavior for non-wiki forum posts.

## Image Upload Contract

Release-one behavior:

- Use NodeBB's existing `POST /api/post/upload`.
- Send `files[]` in `multipart/form-data`.
- Include `x-csrf-token`.
- Expect `response.images[0].url` or `images[0].url`.
- Insert image node with permanent URL.

Do not:

- Store base64 images.
- Allow arbitrary image dimensions through inline styles.
- Add a new upload backend unless NodeBB's endpoint cannot support the editor.

Required UX:

- Paste/drop image uploads with progress or a clear uploading placeholder.
- Failed upload leaves a visible error and does not insert a broken image.
- Save is blocked while uploads are pending.

## Slash Command Contract

Slash menu is a plugin-owned Tiptap extension using open-source primitives.

Trigger:

- `/` at the beginning of an empty paragraph or after whitespace.

Initial commands:

- Paragraph
- Heading 1
- Heading 2
- Heading 3
- Bullet list
- Ordered list
- Task list
- Quote
- Code block
- Table
- Image
- Horizontal rule
- Info callout
- Warning callout
- Danger callout
- Wiki link

Keyboard behavior:

- Arrow up/down moves active item.
- Enter inserts selected item.
- Escape closes menu.
- Backspace in an empty custom block returns to paragraph.
- Mod-K opens link entry.
- Mod-Shift-K opens wiki-link picker.

Implementation detail:

- Use Tiptap commands and plugin state.
- Use a positioned plain DOM menu. Do not add React/Vue solely for this.
- Close the menu on editor blur, composition start, or route change.

## Link Behavior

External links:

- Use Tiptap `Link`.
- Do not navigate when clicked inside the editor.
- Set rendered links to safe `rel` values when `target="_blank"` is used.
- Validate URL protocols on input and sanitize again on save.

Internal wiki links:

- Release one inserts literal wiki syntax returned by
  `/api/v3/plugins/westgate-wiki/link-autocomplete`.
- Preserve `[[Page]]`, `[[Namespace/Page]]`, `[[Page|Label]]`, and
  `[[ns:Namespace]]` as text in saved HTML.
- Existing server transforms continue resolving these at render time.

Future enhancement:

- Display internal links as chips in the editor while serializing them back to
  literal wiki syntax on save. This requires a dedicated extension and must not
  bypass `lib/wiki-links.js`.

## API Contracts

Existing APIs stay:

- `POST /api/v3/topics`
- `PUT /api/v3/posts/:pid`
- `GET /api/v3/plugins/westgate-wiki/page-title/check`
- `GET /api/v3/plugins/westgate-wiki/link-autocomplete`
- `PUT /api/v3/plugins/westgate-wiki/namespace-main-page`
- `PUT /api/v3/plugins/westgate-wiki/discussion`
- `PUT /api/v3/plugins/westgate-wiki/homepage`

Optional new validation API:

```http
POST /api/v3/plugins/westgate-wiki/content/sanitize-preview
Content-Type: application/json

{
  "cid": 12,
  "html": "<p>...</p>"
}
```

Response:

```json
{
  "html": "<p>...</p>",
  "warnings": [
    {
      "code": "dropped-style",
      "message": "Inline styles were removed."
    }
  ]
}
```

This API is useful but not required for release one if server-side save
sanitization is implemented and client-side DOMPurify mirrors it.

## Asset And Build Contract

New desired shape:

```text
tiptap/
  vite.config.mjs
  src/
    wiki-editor-bundle.js
    extensions/
      wiki-callout.js
      slash-command.js
      nodebb-image-upload.js
      wiki-link-shortcuts.js
public/
  vendor/
    tiptap/
      wiki-tiptap.bundle.js
      wiki-tiptap.css
```

Temporary compatibility:

- `lib/compose-assets.js` may continue serving `/westgate-wiki/compose/vendor.js`
  and `/westgate-wiki/compose/vendor.css`, but those aliases should point to
  Tiptap artifacts during the transition.
- Rename public aliases to `/westgate-wiki/compose/editor.js` and
  `/westgate-wiki/compose/editor.css` in the final cleanup.

Package scripts:

- Add `build:tiptap`.
- During migration, `npm test` should syntax-check the Tiptap source bundle if
  it is plain JS and should keep existing server/client checks.
- Remove `build:ckeditor` after final cutover.

Dependency cleanup:

- Remove `ckeditor5` from `package.json`.
- Remove `public/vendor/ckeditor5/`.
- Remove `ckeditor/`.
- Update `THIRD_PARTY_NOTICES.md`.
- Revisit GPL rationale in `README.md`; Tiptap is MIT, but the plugin may
  remain GPL-3.0-or-later for project reasons.

## Styling Contract

Keep existing semantic classes:

- `.westgate-wiki-compose`
- `.wiki-compose-form`
- `.wiki-compose-editor`
- `.wiki-article-prose`

Add Tiptap-specific classes:

- `.wiki-tiptap`
- `.wiki-tiptap-toolbar`
- `.wiki-tiptap-menubar`
- `.wiki-tiptap-slash-menu`
- `.wiki-tiptap-bubble-menu`
- `.wiki-tiptap-floating-menu`
- `.wiki-callout`

CSS variables:

- Keep `--wiki-prose-*` for rendered article typography.
- Keep `--wiki-compose-editable-*` for the editable surface.
- Replace `--wiki-ck-*` with `--wiki-editor-*` aliases.
- For one release, map old `--wiki-ck-*` variables to new editor variables so
  Westgate theme updates can be staged safely.

Cleanup target:

- `public/wiki-article-body.css` should no longer contain CKEditor selectors
  after final cutover.
- Tiptap UI selectors must be scoped to `.westgate-wiki-compose`.
- Floating menus must remain inside the compose root or a plugin-owned portal
  container, not arbitrary body-level UI that escapes theme scope.

## Implementation Roadmap

### Phase 0: Audit And Freeze CKEditor Behavior

Goal: Capture current behavior before replacing it.

Tasks:

1. Create a short fixture set of existing saved article HTML.
2. Include headings, lists, tables, images, links, `[[wiki links]]`,
   footnotes, mentions, code blocks, and raw HTML embeds if used.
3. Record current create/edit save payloads.
4. Record current image upload response shape.
5. Record current editor keyboard behaviors that authors rely on.
6. Decide which CKEditor features are intentionally not carried forward.

Exit criteria:

- There is a fixture folder or documented fixture list.
- The team knows which content features must survive migration.
- CKEditor bug compatibility is not treated as a requirement.

### Phase 1: Tiptap Bundle Skeleton

Goal: Ship a Tiptap editor behind the same compose page lifecycle.

Tasks:

1. Add Tiptap dependencies.
2. Add `tiptap/vite.config.mjs`.
3. Add `tiptap/src/wiki-editor-bundle.js`.
4. Export `window.WestgateWikiEditor`.
5. Implement `createWikiEditor`, `getHTML`, `setHTML`, `insertWikiLink`,
   `focus`, and `destroy`.
6. Point `lib/compose-assets.js` vendor aliases at the Tiptap bundle.
7. Update `public/wiki-compose-page.js` global name from `WikiEditorBundle` to
   `WestgateWikiEditor`, or support both only during the short transition.

Exit criteria:

- Create and edit pages load Tiptap.
- Existing HTML initial content appears in the editor.
- Save still writes HTML to NodeBB.
- No CKEditor JS executes on compose pages.

### Phase 2: Core Editing Parity

Goal: Replace the practical CKEditor authoring surface.

Tasks:

1. Configure StarterKit with heading levels 1-4.
2. Add underline, subscript, superscript, link, image, tables, task lists,
   text align, placeholder, character count, and typography extensions.
3. Build a plugin-owned toolbar with real button state.
4. Add keyboard shortcuts for common marks and blocks.
5. Prevent editor-internal links from navigating away mid-edit.
6. Add pending-upload state and save blocking.
7. Keep `MAX_WIKI_MAIN_BODY_UTF8_BYTES` client and server checks.

Exit criteria:

- Authors can create/edit normal wiki articles without CKEditor.
- Link clicks inside the editor do not navigate away.
- Image upload works through NodeBB's upload API.
- Save/cancel/ajaxify lifecycle is clean.

### Phase 3: Sanitization And Server Trust

Goal: Make Tiptap HTML safe before broad use.

Tasks:

1. Add `lib/wiki-content-sanitize.js`.
2. Add tests for unsafe tags, unsafe URLs, stripped styles, whitelisted
   classes, images, tables, callouts, and wiki syntax preservation.
3. Run sanitizer in wiki create/edit filters.
4. Add client-side sanitization with the same allowlist.
5. Decide whether sanitization mutates content silently or blocks with a clear
   error for high-risk removals.

Exit criteria:

- Unsafe content cannot be persisted through the wiki compose flow.
- Existing valid wiki HTML remains renderable.
- Tests cover the sanitizer's allowlist and denylist.

### Phase 4: Markdown Import And Export

Goal: Preserve authoring interoperability without making Markdown canonical.

Tasks:

1. Implement Markdown import into Tiptap.
2. Implement Markdown export from Tiptap.
3. Keep the existing "Import Markdown" textarea or replace it with a modal.
4. Add an "Export Markdown" control if useful for author workflows.
5. Add fixtures for GFM tables, task lists, links, images, code fences,
   callout fallbacks, and wiki-link syntax.

Exit criteria:

- Markdown import works at least as well as the CKEditor flow.
- Exported Markdown is understandable and preserves wiki-specific syntax.
- Known non-round-tripping cases are documented.

### Phase 5: Custom Blocks And Slash Commands

Goal: Deliver the Notion-like editing model without Pro UI.

Tasks:

1. Implement `wikiCallout`.
2. Implement slash command menu.
3. Add commands for core blocks, tables, images, callouts, and wiki links.
4. Add keyboard handling and mobile fallback behavior.
5. Ensure custom blocks serialize to safe HTML and Markdown fallback.

Exit criteria:

- Slash commands are keyboard usable.
- Custom blocks render in articles and survive edit/save/edit.
- Custom blocks degrade acceptably in Markdown export.

### Phase 6: CKEditor Removal

Goal: Remove CKEditor completely.

Tasks:

1. Delete `ckeditor/`.
2. Delete `public/vendor/ckeditor5/`.
3. Remove `ckeditor5` from dependencies.
4. Rename build script from `build:ckeditor` to `build:tiptap`.
5. Update `lib/compose-assets.js` to serve final Tiptap asset names.
6. Remove CKEditor selectors and variables from CSS.
7. Update README troubleshooting and local workflow.
8. Update `THIRD_PARTY_NOTICES.md`.
9. Update `AGENTS.md` current repository state.
10. Search for `CKEditor`, `ckeditor`, `WikiEditorBundle`, `wiki-ckeditor`,
    and `build:ckeditor`; only historical notes in this transition contract may
    remain.

Exit criteria:

- Repository search shows no active CKEditor code path.
- Fresh install plus `npm run build:tiptap` produces the editor assets.
- `npm test` passes.
- NodeBB build succeeds.
- Create/edit manual smoke tests pass.

### Phase 7: Live Verification And Rollback Plan

Goal: Deploy safely.

Tasks:

1. Test on a staging NodeBB instance with real wiki data.
2. Open and save representative old articles without manual cleanup.
3. Verify article render output before and after save.
4. Verify redlinks, wiki links, mentions, footnotes, image upload, tables,
   mobile toolbar behavior, and cancel navigation.
5. Confirm browser cache busting loads the new Tiptap asset.
6. Keep one tagged release or branch with CKEditor for emergency rollback, but
   do not keep CKEditor code in main after cutover.

Exit criteria:

- Staging smoke checks pass.
- Production deploy checklist exists.
- Rollback is a repository/version rollback, not a runtime editor toggle.

## Testing Requirements

Automated:

- Tiptap bundle builds.
- Server sanitizer unit tests.
- Markdown import/export fixture tests where feasible.
- Existing wiki path, link, mention, footnote, watch, and discussion tests keep
  passing.
- `node --check public/wiki-compose-page.js` keeps passing.

Manual browser checks:

- Desktop create.
- Desktop edit existing CKEditor-authored article.
- Mobile create/edit.
- Image paste/drop/upload.
- Link click inside editor.
- External link edit.
- Internal wiki link insert.
- Slash menu keyboard use.
- Table editing.
- Cancel navigation.
- Save redirect to canonical wiki path.
- Browser back/forward under NodeBB ajaxify.

Visual checks:

- Editor matches Westgate theme.
- Toolbar does not wrap into unusable controls on mobile.
- Slash menu and link popovers do not escape dark theme styling.
- Article output remains consistent with editor content.

## Edge Cases And Fringe Considerations

Existing CKEditor HTML:

- Tiptap may normalize HTML on load/save. Accept semantic normalization, but
  test tables, figures, captions, images, links, and raw HTML embeds.
- Unknown unsupported tags should either be preserved by a deliberate extension
  or stripped with a warning. Silent destructive loss is not acceptable.

Raw HTML:

- CKEditor allowed broad HTML through `GeneralHtmlSupport`.
- Tiptap should not carry forward broad arbitrary HTML by default.
- If raw HTML is needed, add a constrained `wikiRawHtml` block only for trusted
  groups and sanitize aggressively.

Tables:

- Tables are high-risk for mobile editing and Markdown round trips.
- Keep initial controls simple: insert table, add/remove row, add/remove column,
  merge/split if practical.

Embeds:

- Do not add arbitrary `iframe` support in release one.
- If media embeds are needed, create a whitelist for providers and attributes.

Classes and styles:

- Existing content may contain CKEditor classes such as image alignment classes.
- Map common old classes to wiki-owned classes during sanitization or preserve a
  narrow compatibility allowlist.
- Do not allow arbitrary inline color/font/size styling in release one.

Copy/paste:

- Paste from Word/Google Docs should be sanitized and simplified.
- Pasted images should upload, not persist as base64.
- Pasted external HTML should not keep unsafe classes/styles.

IME and mobile:

- Slash command handling must not break composition events.
- Test mobile Safari/Chrome selection, toolbar overflow, virtual keyboard, and
  scroll anchoring.

Accessibility:

- Toolbar buttons need labels and pressed states.
- Slash menu needs active descendant semantics or equivalent keyboard feedback.
- Focus rings must be visible under Westgate theme.
- Error messages must use the existing `#wiki-compose-status` live region or an
  equivalent.

Performance:

- Keep bundle size visible in build output.
- Avoid importing large optional packages until required.
- Large articles must stay responsive up to the existing 512 KiB HTML limit.

Caching:

- NodeBB asset caching has caused stale editor files before.
- Keep `/westgate-wiki/compose/...` asset serving and cache-buster handling.
- After asset rename, verify MIME type and cache behavior in Firefox and
  Chromium.

Search:

- NodeBB search currently indexes post content.
- Sanitized HTML should remain text-extractable.
- If future JSON storage is added, implement a search text projection first.

Diffs/history:

- NodeBB post history will diff HTML.
- Tiptap normalization can make large diffs on first save of old CKEditor
  content. Warn admins before mass editing or migration scripts.

Permissions:

- Editor availability still depends on existing `canCreatePage` and
  `canEditWikiPage`.
- Custom raw/advanced blocks, if any, require separate permission checks.

Rollback:

- Full CKEditor removal is still the priority.
- Rollback should be done by reverting the deployment version, not by keeping a
  permanent CKEditor/Tiptap toggle in production.

## Definition Of Done

The migration is complete when:

- CKEditor source, vendored assets, dependency, build script, and active docs
  are removed.
- Tiptap is the only compose editor.
- Wiki pages are still stored as safe HTML in NodeBB first posts.
- Existing wiki articles open, edit, save, and render correctly.
- Internal wiki links, redlinks, mentions, footnotes, article watch behavior,
  title validation, discussion settings, namespace main page controls, and
  homepage setup still work.
- Open-source-only dependency requirements are met.
- `npm test`, `npm run build:tiptap`, and NodeBB asset build pass.
- Staging smoke tests pass on desktop and mobile.
