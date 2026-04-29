# AGENTS.md

## Purpose

This repository is a NodeBB plugin that adds a Westgate-specific wiki surface on top of forum content. The package is **GPL-3.0-or-later** (CKEditor 5 GPL bundle). Wiki page creation uses **`/wiki/compose/:cid`** with a vendored CKEditor build under `public/vendor/ckeditor5/` (rebuild with `npm run build:ckeditor`).

Current design baseline:

- `Topics` act as wiki pages.
- The first post is the canonical article body.
- Categories act as wiki sections or namespaces.
- The plugin must extend NodeBB instead of replacing core forum behavior.

This file is the execution plan for initializing the project from its current scaffold into a working, testable plugin.

## Current Repository State

The repo already contains a minimal starting point:

- `package.json`
- `plugin.json`
- `library.js`
- `templates/wiki.tpl`
- `public/wiki.css`

The existing implementation already does the following:

- Registers `static:app.load`
- Adds a `/wiki` route
- Adds a `/wiki/category/:category_id/:slug?` section route for configured wiki categories
- Adds a `/wiki/:topic_id/:slug?` article route for configured wiki categories
- Renders a landing page from ACP-managed settings
- Treats configured categories as wiki namespaces, with NodeBB category permissions remaining the source of truth for visibility
- Surfaces configured child categories as nested namespaces on section pages
- Builds wiki breadcrumbs through configured parent namespaces
- Ships a first-pass template and stylesheet
- Exposes an ACP settings page for wiki configuration
- Exposes an ACP namespace selector so admins can choose wiki-enabled categories without hand-editing IDs
- Supports automatic descendant namespace inclusion so selecting a parent can expose its nested categories through the wiki
- Exposes wiki-oriented page creation actions that still use NodeBB topic creation under the hood
- Exposes a wiki page navigation rail for namespace-local browsing
- Supports first-pass internal wiki links in article bodies via `[[Page Title]]`, `[[Child Namespace/Page Title]]`, and `[[Root Namespace/Child Namespace/Page Title]]`
- Treats unresolved wiki links as redlinks that open prefilled page creation in the target namespace
- Exposes reusable internal services through `plugin.services` for future extension work
- Uses route and service modules instead of placing everything in `library.js`

The implementation does not yet provide a real initialization standard, configuration flow, page rendering model, or verification discipline. This document fills that gap.

## Initialization Objective

Initialize the plugin so that a developer or agent can take it from scaffold to MVP in a controlled order, with explicit completion criteria and without inventing architecture mid-flight.

## Working Rules

When changing this plugin:

1. Preserve NodeBB core behavior.
2. Prefer small, verifiable steps over broad rewrites.
3. Keep wiki logic isolated in plugin-owned modules.
4. Do not hard-code site-specific IDs once configuration exists.
5. Do not assume a specific database backend beyond NodeBB abstractions.
6. Treat `/wiki` as a presentation layer over forum data, not a separate content system.
7. Prefer exposing stable plugin-owned helpers over duplicating wiki resolution logic in future files.

## Target MVP

The first usable version of this plugin must support:

- A configurable `/wiki` landing page
- Category-backed wiki sections
- Nested wiki namespaces when configured categories are parent/child in NodeBB
- Topic listings per wiki section
- A dedicated wiki page view for a topic slug
- Clean wiki styling that coexists with the active NodeBB theme
- Graceful handling of missing categories, empty sections, and disabled configuration

Anything beyond that is phase-two work, unless a later section of this file explicitly updates the boundary.

## Recommended Project Shape

The plugin can stay small at first, but code should be split once the second route or second data transform appears.

Recommended structure:

```text
nodebb-plugin-westgate-wiki/
├── AGENTS.md
├── package.json
├── plugin.json
├── library.js
├── lib/
│   ├── config.js
│   ├── wiki-service.js
│   ├── topic-service.js
│   └── serializer.js
├── routes/
│   └── wiki.js
├── public/
│   └── wiki.css
└── templates/
    ├── wiki.tpl
    └── wiki-page.tpl
```

This is not mandatory on day one, but it is the intended direction once the landing-page-only prototype grows.

## Step-By-Step Initialization Plan

### Phase 0: Baseline Audit

Goal:
Establish what exists and remove ambiguity before feature work starts.

Tasks:

1. Confirm plugin metadata and NodeBB compatibility in `package.json` and `plugin.json`.
2. Confirm the only active hook is `static:app.load`.
3. Confirm `/wiki` renders successfully with the current template.
4. Identify every hard-coded project assumption, starting with `wikiCids = [12, 13, 14]`.
5. Record missing operational basics such as scripts, linting, and local test instructions.

Exit criteria:

- The current scaffold is understood.
- Hard-coded assumptions are enumerated.
- The next implementation step is configuration, not more route logic.

### Phase 1: Configuration Foundation

Goal:
Replace hard-coded wiki category assumptions with plugin configuration.

Tasks:

1. Add a plugin settings model for wiki category IDs or slugs.
2. Decide whether categories are configured by numeric `cid`, slug, or both.
3. Add config load helpers so route code does not read raw settings directly.
4. Define sane behavior when config is missing:
   - render an empty state for regular users
   - render an admin-facing setup hint if appropriate
5. Remove hard-coded category IDs from `library.js`.

Exit criteria:

- `/wiki` no longer depends on hard-coded category IDs.
- Missing config does not crash the route.
- Config access is centralized.

### Phase 2: Route and Service Separation

Goal:
Stop putting all logic in `library.js`.

Tasks:

1. Keep `library.js` as the plugin entrypoint only.
2. Move route registration into `routes/wiki.js`.
3. Move category/topic retrieval into a service module.
4. Normalize outgoing view data before rendering templates.
5. Ensure every async failure reaches `next(err)` cleanly.

Exit criteria:

- Entry, route, and data concerns are separated.
- The landing page still renders with the same behavior.
- The codebase is ready for a second wiki route without becoming tangled.

### Phase 3: Landing Page Hardening

Goal:
Turn the current `/wiki` page into a reliable MVP surface.

Tasks:

1. Add empty-state rendering when no wiki sections are configured.
2. Handle invalid or deleted categories without breaking the whole page.
3. Limit or paginate listed topics deliberately instead of using implicit defaults.
4. Decide how many topics to show per section and keep that configurable or constant.
5. Improve template semantics so the page is usable on desktop and mobile.
6. Keep CSS scoped to wiki classes to avoid bleeding into forum pages.

Exit criteria:

- `/wiki` behaves predictably with good data and bad data.
- The UI remains readable with zero, few, or many topics.

### Phase 4: Wiki Page Route

Goal:
Add a dedicated wiki article view.

Tasks:

1. Introduce a canonical wiki article route. Current implementation uses `/wiki/:topic_id/:slug?` to match NodeBB topic slugs.
2. Resolve the topic through NodeBB APIs, not direct database assumptions.
3. Treat the first post as article content.
4. Fetch enough topic metadata to render title, breadcrumbs, category, author, and timestamps.
5. Decide whether discussion replies are hidden, collapsed, or linked out for MVP.
6. Add `templates/wiki-page.tpl`.

Exit criteria:

- A topic can be viewed through a wiki-oriented route.
- Missing or invalid slugs return proper NodeBB-style errors or 404 behavior.

### Phase 5: Authoring and Navigation Decisions

Goal:
Define the rules that make topics behave like wiki pages.

Tasks:

1. Decide how wiki pages are identified:
   - topic in configured category
   - tag-based inclusion
   - explicit topic setting
2. Decide slug canonicalization rules.
3. Decide whether `/topic/:slug` and `/wiki/:slug` should both exist and which is canonical.
4. Add breadcrumb and cross-navigation from landing page to article page.
5. Document what qualifies as wiki content versus normal forum content.
6. Clarify how configured child categories behave as nested wiki namespaces.

Exit criteria:

- The plugin has a clear content model.
- Routing behavior is consistent and documented.

### Phase 6: Admin and Operational Readiness

Goal:
Make the plugin maintainable instead of purely demo-ready.

Tasks:

1. Add basic npm scripts such as `lint` and `test` if the toolchain exists.
2. Add a local development note describing how to install the plugin into a NodeBB instance.
3. Add verification instructions for rebuilding NodeBB assets after plugin changes.
4. Add a short troubleshooting section for empty wiki pages, bad config, and missing categories.
5. Keep this `AGENTS.md` synchronized with actual repository state.

Exit criteria:

- Another developer can stand the plugin up without guessing.
- The plugin has at least a minimal repeatable validation flow.

### Phase 7: Wiki Authoring Behavior

Goal:
Move the plugin further away from forum-shaped navigation and closer to wiki-shaped authoring.

Tasks:

1. Keep `Create Page` and `Create Sibling Page` inside the wiki flow after submit.
2. Support internal wiki links in article bodies.
3. Treat unresolved internal links as redlinks rather than dead text.
4. Make redlinks resolve to the target namespace and launch prefilled page creation.
5. Resolve namespaced links by current namespace, full namespace path, or unique suffix path where safe.
6. Keep discussion-thread access available without making it the primary page flow.

Exit criteria:

- Human authors can navigate between pages through wiki links.
- Missing links provide a create path instead of a dead end.
- Page creation remains namespace-aware.

### Phase 8: Westgate Theme Alignment

Goal:
Bring wiki editor chrome and wiki page containers in line with
`nodebb-theme-westgate` while keeping Westgate-specific visual decisions in the
theme rather than duplicating theme CSS in this plugin.

Assessment, 2026-04-29:

- The plugin already exposes the right theming contract in `public/wiki.css` and
  `public/wiki-article-body.css`: wiki surfaces, prose, floating tools,
  redlinks, and CKEditor all route through `--wiki-*` custom properties with
  Bootstrap fallbacks.
- The Westgate theme already consumes that contract in
  `/home/vicky/Projects/nodebb-dev/nodebb-theme-westgate/scss/westgate/_wiki-prose.scss`.
  It sets Westgate palette variables and gives selected wiki cards the same
  shadow as forum cards.
- The plugin templates already provide useful semantic hooks:
  `.westgate-wiki`, `.wiki-page-content`, `.wiki-namespace-index`,
  `.wiki-sidebar-panel`, `.wiki-article-toc`, `.wiki-status-card`,
  `.wiki-card`, `.wiki-topic-card`, `.wiki-compose-form`,
  `.wiki-compose-editor`, and `.wiki-article-prose`.
- Screenshot 1 editor issues are mostly theme-skin issues, not data-flow
  issues: CKEditor focus still presents too much like browser/default blue,
  toolbar button sizing/wrapping is cramped, and the compose form reads flatter
  than the forum's velvet category/topic panels.
- Screenshot 2 vs screenshot 3 container mismatch is also mostly theme-side:
  forum category rows use richer `--wg-velvet-panel`, muted gold borders,
  `8px` radius, and `--wg-velvet-shadow`; wiki article and sidebar cards are
  close structurally but flatter and less connected to the forum container
  language.
- The plugin currently uses `.card` on the right elements. That should stay.
  The next step is to make the active theme style those cards more precisely,
  not to hard-code Westgate gradients into plugin CSS.

Ownership decision:

- Plugin owns stable semantic classes, neutral layout, CKEditor loading, and
  fallback CSS.
- `nodebb-theme-westgate` owns the Westgate visual result in
  `scss/westgate/_wiki-prose.scss`.
- Prefer adding or correcting plugin classes only when the theme lacks a stable
  selector. Do not add one-off Westgate palette values to `public/wiki.css`.

Tasks:

1. Confirm rendered wiki pages use the template hooks expected by the theme:
   article view, namespace view, landing page, redlink missing-page state, and
   compose/edit page.
2. In `nodebb-theme-westgate/scss/westgate/_wiki-prose.scss`, expand the wiki
   surface list to cover all real plugin containers that need forum-style
   depth:
   `.wiki-page-content`, `.wiki-namespace-index`, `.wiki-sidebar-panel`,
   `.wiki-article-toc`, `.wiki-status-card`, `.wiki-card`,
   `.wiki-topic-card`, and `.wiki-compose-form`.
3. Match those surfaces to the forum container contract:
   `background: var(--wg-velvet-panel)`, `border: 1px solid var(--wg-border)`,
   `border-radius: 8px`, `box-shadow: var(--wg-velvet-shadow)`, and the same
   restrained hover/focus treatment where interaction exists.
4. Keep the wiki article body document-like inside the shell: preserve readable
   prose line height and spacing, but use Westgate heading, link, code,
   blockquote, table, and caption variables from the theme.
5. Theme the TOC/sidebar as compact utility panels, not nested decorative
   cards: muted headings, gold links, clear active/current row states, tight
   indentation, and stable sticky/mobile behavior.
6. Theme the floating wiki action dock with the same icon-button language as
   forum tools: fixed dimensions, muted gold icon color, clear hover/focus
   states, and restrained danger treatment for delete.
7. Theme the compose editor in `nodebb-theme-westgate` through the existing
   `--wiki-ck-*` and `--wiki-compose-*` variables:
   toolbar background/border, button hover/on states, disabled state, dropdown
   panels, tooltip colors, input colors, source-editing view, editable
   background, and editable focus ring.
8. Replace the visible blue editor focus with a muted gold focus border/shadow
   that remains accessible.
9. Normalize CKEditor toolbar wrapping and density through theme selectors
   scoped to `.westgate-wiki-compose` or `body:has(#westgate-wiki-compose)`.
   Verify dropdown and balloon panels because CKEditor may mount them outside
   the editor element.
10. Add plugin-side classes only if theme selectors would otherwise have to be
    brittle. Candidate additions, if needed: a class on the article layout root
    for page-vs-namespace composition and a class on the compose card for
    theme-owned editor shell styling.

Exit criteria:

- Wiki page article, TOC, namespace index, status cards, and compose form share
  the forum's container depth and palette without moving Westgate CSS into the
  plugin.
- CKEditor toolbar, dropdowns, focus states, and editable area match the active
  Westgate theme at desktop and mobile widths.
- Forum category styling remains unchanged except for deliberate shared-token
  consistency.
- The plugin still degrades cleanly under non-Westgate themes through its
  Bootstrap-backed `--wiki-*` fallbacks.

## Deferred Work

These items are intentionally out of initialization scope unless the project explicitly expands:

- Revision history
- Infobox or template systems
- API publishing endpoints
- Search indexing
- Compare or revert views
- Custom editor workflows
- Wiki-only namespaces created directly from plugin ACP
- Hiding wiki namespaces from standard forum category surfaces without breaking NodeBB assumptions
- Full DokuWiki-style sidebar/tree navigation
- Dedicated wiki revision UI separate from NodeBB post history

Do not start on these until the MVP route and configuration model are stable.

## Verification Checklist

Run or manually verify these after each major step:

1. Plugin loads without NodeBB startup errors.
2. `/wiki` renders when configuration exists.
3. `/wiki` renders an empty state when configuration is absent.
4. Invalid configured category IDs do not crash the route.
5. Wiki CSS only affects wiki pages.
6. `/wiki/category/:category_id/:slug?` resolves a configured category and redirects to the canonical wiki section URL when needed.
7. `/wiki/:topic_id/:slug?` resolves a valid configured topic.
8. Missing slugs fail cleanly.
9. Restart NodeBB when changing `plugin.json`, server-side route registration, or plugin initialization code.
10. Rebuild NodeBB assets when changing plugin templates or CSS.
11. For Westgate theme alignment, rebuild assets after theme SCSS changes and
    compare `/categories`, a wiki article page, a wiki namespace page, and a
    wiki compose/edit page at desktop and mobile widths.
12. Check CKEditor toolbar wrapping, dropdowns, balloon panels, focus rings,
    source-editing mode, and editable prose styling on the compose page.

## Content Model

- Configured categories are wiki namespaces.
- Topics inside configured categories are wiki pages.
- Configured child categories remain normal NodeBB categories underneath, but are surfaced in the wiki as nested namespaces.
- Category visibility and posting/editing behavior still come from NodeBB category permissions, so group-based access can be managed with the existing category privilege system.
- The `/wiki` landing page should prefer root configured namespaces; child namespaces are reached from their parent namespace pages.
- Wiki namespace enablement is plugin-specific configuration layered on top of normal NodeBB categories.
- Automatic descendant inclusion is a quality-of-life layer on top of explicit namespace selection, not a replacement for NodeBB category permissions.
- The canonical wiki view is `/wiki/:topic_id/:slug?`; `/topic/:slug` remains the discussion thread view for the same underlying topic.

## Completed Steps

- Configuration is ACP-backed through `westgate-wiki` settings.
- Landing-page and article route logic live outside `library.js`.
- Wiki section navigation now stays within the plugin surface instead of sending users directly to the core category view.
- The plugin now has a minimal `npm test` syntax-check script and a local development README.
- ACP now exposes a category tree selector for wiki namespaces instead of relying on raw category ID entry alone.
- Wiki navigation now supports configured namespace hierarchy across root namespaces, child namespaces, and article breadcrumbs.
- Parent namespaces can now automatically include descendant categories as effective wiki namespaces.
- Wiki namespaces now expose page-creation affordances when NodeBB category permissions allow topic creation.
- Wiki article pages now expose namespace-local navigation for sibling pages and child namespaces.

Mark items here as work lands in the repository.

- [x] Minimal plugin scaffold exists.
- [x] `static:app.load` hook is registered.
- [x] `/wiki` route exists.
- [x] Initial landing page template exists.
- [x] Initial wiki stylesheet exists.
- [x] Initialization plan has been documented in this file.
- [x] Hard-coded wiki category IDs have been replaced with ACP-managed settings.
- [x] Plugin configuration for wiki categories exists.
- [x] Route logic has been split out of `library.js`.
- [x] Service helpers exist for category and topic loading.
- [x] `/wiki` now handles setup-required and invalid-category states.
- [x] ACP navigation for plugin settings exists.
- [x] A first `/wiki/:topic_id/:slug?` article route exists for configured wiki categories.
- [x] `wiki-page.tpl` exists.
- [x] Root wiki namespaces are separated from nested configured namespaces on the landing page.
- [x] ACP provides a category tree UI for selecting wiki-enabled namespaces.

## Pending Steps

- [x] Add operational scripts or documented manual checks.
- [ ] Verify the plugin in a live NodeBB development instance.
- [-] Implement the Westgate theme alignment plan in
  `nodebb-theme-westgate/scss/westgate/_wiki-prose.scss`, using this plugin's
  existing `--wiki-*` hooks and semantic classes.
  - [x] Added a neutral `--wiki-compose-editable-focus-shadow` hook in
    `public/wiki-article-body.css` so themes can own CKEditor editable focus
    styling.
  - [x] Expanded `nodebb-theme-westgate/scss/westgate/_wiki-prose.scss` to
    style wiki page, namespace, sidebar/TOC, status, card, floating action, and
    compose/editor surfaces through the plugin's existing semantic classes.
  - [x] `npm test` passes in this plugin.
  - [x] `./nodebb build` succeeds in `/home/vicky/Projects/nodebb-dev/forum`.
  - [-] Local anonymous Playwright smoke checks passed for `/wiki`,
    `/wiki/30/big-test-1`, mobile `/wiki/30/big-test-1`, and `/categories`.
    Authenticated CKEditor visual validation remains pending because
    `/wiki/edit/30` redirects to login in the test session.
  - [x] Follow-up editor pass tightened wiki composer CKEditor button theming
    in `nodebb-theme-westgate/scss/westgate/_wiki-prose.scss`: toolbar
    buttons, split buttons, text buttons, color/input-color buttons, dropdown
    panel buttons, dialog buttons, hover/focus/on/disabled states, icon fill,
    and body-mounted CKEditor panel variables now use Westgate dark/gold
    styling instead of CKEditor's light defaults.
  - [x] `./nodebb build` still succeeds after the editor button pass.
  - [ ] Authenticated visual validation still needs to confirm the hover/on
    state shown in the reported composer screenshot no longer flashes a light
    button background.
  - [x] Follow-up source/code block pass updated
    `nodebb-theme-westgate/scss/westgate/_wiki-prose.scss` so CKEditor source
    editing areas use dark Westgate editor colors and wiki code blocks render
    as raised dark wells with gold-edged borders, themed code text, and dark
    language labels.
  - [x] `./nodebb build` still succeeds after the source/code block pass.
  - [ ] Authenticated visual validation still needs to confirm source editing
    mode and code block widgets in the composer no longer use light/Harmony
    defaults.
  - [x] Follow-up CKEditor popup pass updated the Westgate theme selectors for
    the insert-table grid and emoji picker so popup cells, labels, search
    fields, category buttons, and hover/focus states stay on dark Westgate
    panel colors instead of CKEditor's light/default floating text.
  - [x] `./nodebb build` still succeeds after the popup theming pass.
  - [x] Follow-up color-grid pass excluded CKEditor color selector tiles from
    the generic dark popup button overrides so marker/font color swatches keep
    their actual colors while still using Westgate focus rings and labels.
  - [x] `./nodebb build` still succeeds after the color-grid pass.
  - [ ] Authenticated visual validation still needs to confirm CKEditor
    body-mounted popups inside the wiki composer match the reported table and
    emoji picker screenshots.

## Agent Execution Order

If an agent is asked to initialize this project, execute in this order:

1. Complete Phase 0 and Phase 1 before adding new features.
2. Complete Phase 2 before adding `/wiki/:slug`.
3. Complete Phase 3 and Phase 4 to reach MVP.
4. Stop and update this file before starting deferred work.

## Definition of Done For Initialization

Initialization is complete when all of the following are true:

- The plugin no longer relies on hard-coded wiki category IDs.
- `/wiki` is configuration-driven and resilient.
- Route logic is modular enough to support growth.
- A wiki page route exists and renders a topic as an article.
- Manual verification steps are documented and usable.
- Namespace configuration and navigation are manageable without hand-editing IDs.
- The completed and pending sections in this file reflect reality.
