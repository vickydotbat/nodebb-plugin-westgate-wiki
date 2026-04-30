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

## Planned Work: Human-Readable Wiki Paths

Current wiki article URLs inherit NodeBB topic slugs:

```text
/wiki/29/map-creation-guide
```

That is stable and easy to resolve because the topic id is embedded in the
path, but it is not wiki-shaped. The desired canonical URL should use configured
wiki namespace/category paths followed by the page slug:

```text
/wiki/development/guides/map-creation-guide
```

This should be implemented as a plugin-owned routing layer over NodeBB
categories and topics. NodeBB category and topic ids should remain internal
identifiers, not public wiki path requirements.

### Assessment

The plugin already has the data model needed for this:

- Configured categories are wiki namespaces.
- Child categories can be included as nested namespaces.
- Topic titles and NodeBB slugs already provide page slugs.
- Internal wiki links already resolve namespace paths in
  `lib/wiki-links.js`.
- Serialization currently emits `/wiki/${topic.slug}`, which preserves the
  topic id because NodeBB topic slugs include it.

The missing piece is a canonical wiki path resolver that maps:

```text
namespace/category path + page slug -> category + topic
```

without relying on the topic id in the request path.

### Phase 0: Define Canonical Path Rules

Goal:
Make URL behavior deterministic before changing routes.

Rules:

1. Namespace segments come from the configured category hierarchy.
2. Page segments come from the NodeBB topic slug leaf with the numeric topic id
   removed.
3. The canonical article path is
   `/wiki/:namespace_path_segments/:page_slug`.
4. The canonical namespace index path is `/wiki/:namespace_path_segments`.
5. Existing ID-based paths continue to resolve and redirect to canonical paths.
6. If a namespace and page would produce the same path, namespace wins for the
   index route and page creation must reject or disambiguate the collision.

Exit criteria:

- Every wiki namespace has one canonical public path.
- Every wiki page has one canonical public path.
- Existing URLs remain backward compatible through redirects.

### Phase 1: Build A Path Resolver Service

Goal:
Centralize URL construction and lookup instead of scattering path logic through
routes and serializers.

Tasks:

1. Add a plugin service such as `lib/wiki-paths.js`.
2. Build namespace paths from category ancestors within the effective wiki
   namespace set.
3. Normalize path segments with the same slug rules used by NodeBB for category
   and topic slugs where possible.
4. Resolve a namespace path to a category id.
5. Resolve a full article path to `{ cid, tid, topic }` by finding a topic in
   the resolved category whose slug leaf matches the requested page slug.
6. Return structured failure reasons:
   - namespace not found
   - page not found in namespace
   - ambiguous duplicate page slug
   - hidden or unauthorized content

Exit criteria:

- Routes, breadcrumbs, internal wiki links, and navigation can ask one service
  for canonical wiki URLs.
- No template needs to manually construct `/wiki/${topic.slug}`.

### Phase 2: Add Canonical Routes

Goal:
Support clean URLs while preserving the current ID-based routes during
migration.

Tasks:

1. Add a catch-all wiki route for canonical paths after more specific routes:
   `/wiki/:path(*)`.
2. Resolve the path first as a namespace index, then as a page within the
   deepest matching namespace.
3. Keep existing routes:
   - `/wiki/category/:category_id/:slug?`
   - `/wiki/:topic_id/:slug?`
4. Change existing routes to redirect to the canonical namespace or page path
   for non-API requests.
5. Ensure utility routes such as `/wiki/compose/:cid`,
   `/wiki/edit/:topic_id`, and `/wiki/namespace/create/:parent_cid` are matched
   before the catch-all route.

Exit criteria:

- `/wiki/development/guides/map-creation-guide` renders the article.
- `/wiki/29/map-creation-guide` redirects to the canonical article URL.
- `/wiki/category/12/development/guides` redirects to the canonical namespace
  URL.
- Compose, edit, delete, and namespace-create routes remain unaffected.

### Phase 3: Update Link Generation

Goal:
Make every wiki-facing link prefer canonical paths.

Tasks:

1. Update `lib/serializer.js` to emit canonical `wikiPath` values for sections
   and topics.
2. Update `lib/wiki-links.js` so `[[Page]]`, `[[Namespace/Page]]`, and
   `[[ns:Namespace]]` render clean wiki URLs.
3. Update breadcrumbs in `lib/wiki-breadcrumb-trail.js`.
4. Update namespace search results in `lib/wiki-namespace-search.js`.
5. Update compose cancel/redirect targets so authors return to clean URLs after
   create or edit.
6. Keep forum discussion links pointed at `/topic/{topic.slug}` because the
   forum view is still NodeBB-owned.

Exit criteria:

- New links generated by the wiki no longer expose topic ids or category ids.
- Forum discussion links still use normal NodeBB topic URLs.

### Phase 4: Collision And Rename Handling

Goal:
Handle the cases that numeric ids used to make trivial.

Tasks:

1. Detect duplicate page slug leaves inside the same namespace.
2. On collision, either reject the new page title or route the duplicate through
   a deterministic fallback until renamed.
3. Redirect old clean paths after topic or category renames where practical.
4. Consider storing lightweight alias records for renamed wiki pages and
   namespaces if real content frequently changes names.
5. Keep redirects loop-safe and bounded.

Exit criteria:

- Clean URLs remain predictable when pages are renamed.
- Duplicate titles do not silently point to the wrong page.

### Phase 5: Verification

Run these checks before considering clean paths complete:

1. Root namespace, child namespace, and deeply nested namespace URLs render.
2. Article URLs render at `/wiki/{namespace path}/{page slug}`.
3. Current ID-based article and category URLs redirect to canonical paths.
4. Internal wiki links generate canonical URLs.
5. Redlinks still open page creation in the intended namespace.
6. Private or unauthorized namespaces do not leak through path lookup.
7. Slug collisions fail safely.
8. NodeBB `/topic/...` forum routes continue to work.

## Planned Work: Wiki-Aware Revision History

NodeBB's built-in post edit history is forum-shaped. The current core path is:

- `forum/src/posts/diffs.js` stores reverse unified patches for each edit and
  reconstructs a full historical post snapshot on demand.
- `forum/src/api/posts.js#getDiffs` returns all revision metadata at once.
- `forum/public/src/client/topic/diffs.js` opens a Bootbox modal, renders a
  single `<select>`, and loads one full reconstructed post into
  `partials/posts_list`.
- `forum/src/views/modals/post-history.tpl` is designed around selecting and
  viewing an entire post revision.

That works acceptably for short forum posts, but it is a poor default for wiki
articles because a single article revision can be several screens long and the
most useful question is usually "what changed?", not "show the whole page at
this timestamp."

### Assessment

The apparent "only the most recent revision is visible" issue should be treated
as a UI and data-flow problem until proven otherwise. NodeBB currently returns a
full revision list, but the modal collapses that list into a normal single-row
select and immediately fills the modal with the full current post. For large
wiki articles, the revision navigation is visually dominated by the rendered
article and can become slow or hard to use.

The larger issue is architectural: `GET /posts/:pid/diffs/:since` returns a
full post snapshot and the client renders it as a forum post. That means wiki
history inherits forum presentation, including the entire article body, author
row, image layout, and topic-post chrome.

### Phase 0: Verify The Current Failure Mode

Goal:
Confirm whether NodeBB is losing revisions or only presenting them poorly.

Tasks:

1. Inspect the API response for a large wiki article through
   `/api/v3/posts/:pid/diffs` or the existing write route used by
   `forum/topic/diffs`.
2. Count `timestamps`, `revisions`, and the rendered `<select> option` nodes in
   the modal DOM.
3. Record article content size, revision count, modal render time, and whether
   `posts.diffs.load` reconstruction becomes slow.
4. Repeat the same checks with a normal forum post to avoid breaking the forum
   use case while optimizing wiki behavior.

Exit criteria:

- We know whether the data layer returns every revision.
- We know whether the problem is select usability, full-post rendering cost, or
  an actual truncation bug.

### Phase 1: Low-Risk Modal Improvements

Goal:
Improve the existing NodeBB history modal without changing the diff storage
format or forum restore/delete semantics.

Tasks:

1. Replace the single-row revision `<select>` with a scrollable revision list or
   compact table showing timestamp, editor, current/original markers, and
   deleted state.
2. Keep restore and delete wired to the existing NodeBB endpoints and privilege
   checks.
3. Avoid loading full post content until a revision is selected intentionally.
4. Add a "View full revision" action instead of making full snapshot rendering
   the default.
5. Add a content-length threshold so long posts default to compact history while
   short forum posts can keep the existing behavior.

Exit criteria:

- Forum history remains familiar.
- Wiki history no longer opens directly into a full article wall.
- All existing permissions and restore/delete behavior are preserved.

### Phase 2: Diff-First API Surface

Goal:
Add a non-breaking way to ask "what changed?" instead of "render the whole post
at this revision."

Tasks:

1. Add or propose a NodeBB endpoint such as
   `GET /posts/:pid/diffs/compare?from=&to=&mode=text|html|wiki`.
2. Return structured data:
   - revision endpoints and timestamps
   - editor metadata
   - title/tag changes
   - added, removed, and changed counts
   - changed hunks with limited surrounding context
   - collapsed unchanged block counts
3. Preserve the existing `GET /posts/:pid/diffs/:since` snapshot endpoint for
   compatibility.
4. Escape or sanitize all diff output before rendering because wiki articles
   are HTML-heavy.
5. Reuse `diffsPrivilegeCheck` and existing post history privileges.

Exit criteria:

- Consumers can render compact revision comparisons without loading a full
  post partial.
- Existing NodeBB clients continue to work.

### Phase 3: Wiki-Specific History UI

Goal:
Give wiki pages their own revision history experience while still using NodeBB's
post history as the source of truth.

Tasks:

1. Add a wiki-owned route such as `/wiki/:topic_id/:slug?/history`.
2. Treat the first post `pid` as the article revision target.
3. Build a two-pane layout:
   - left: paginated or virtualized revision list
   - right: selected comparison, defaulting to selected revision versus previous
     revision or current revision
4. Render title/tag changes separately from body changes.
5. Group body changes by wiki section heading when possible.
6. Provide "View full revision" and "Restore this revision" as secondary
   actions, not the primary view.
7. Link from the wiki article byline or tools area to the wiki history route.

Exit criteria:

- Wiki users see a history page that answers what changed first.
- Full historical snapshots remain available but no longer dominate the flow.
- The implementation remains a presentation layer over NodeBB post diffs.

### Phase 4: Plugin Integration Strategy

Goal:
Keep the wiki plugin independent enough to ship locally while identifying which
parts should become NodeBB core improvements.

Tasks:

1. Start plugin-side by wrapping existing NodeBB diff services where practical.
2. If direct access to `posts.diffs` is not clean from the plugin, add the
   smallest NodeBB hook or API extension needed for revision comparison.
3. Candidate core hooks:
   - `filter:post.getDiffs` for metadata enrichment already exists.
   - A new load/compare hook for compact diff output.
   - A client hook before `forum/topic/diffs` opens its modal, allowing plugins
     to substitute a custom history UI for wiki main posts.
4. Avoid storing separate wiki revision records in phase one. NodeBB post
   history should remain authoritative.

Exit criteria:

- The plugin can provide a wiki-first history UI without forking the whole topic
  history implementation.
- Any NodeBB core change is small, reusable for forums, and not Westgate-only.

### Phase 5: Large Article Performance

Goal:
Make revision history usable for long wiki articles with many edits.

Tasks:

1. Add pagination or cursor support to revision metadata instead of loading all
   revisions forever.
2. Cache reconstructed snapshots or comparison summaries by `pid`, revision
   pair, and current edit timestamp.
3. Lazy-render diff hunks and collapse unchanged content by default.
4. Consider a wiki-only section index that stores heading anchors or block hashes
   at save time, but only after the basic diff-first UI proves insufficient.

Exit criteria:

- A large wiki article with dozens of revisions opens quickly.
- Comparing revisions does not require rendering the entire article body.

### Phase 6: Verification

Run these checks before considering the feature complete:

1. Large wiki article with many revisions shows every revision in the history
   list.
2. Opening history defaults to compact diff output, not full article output.
3. Full revision view still works when requested.
4. Restore and delete still respect NodeBB privileges.
5. A normal forum post still has a reasonable history experience.
6. HTML-heavy article diffs do not produce unsafe or broken markup.
7. Mobile history view remains navigable.

## Planned Work: Forum/Wiki Feed Separation

Current wiki categories are hidden from the forum category tree by
`lib/filter-categories-forum.js`, but their topics can still appear in global
forum activity surfaces because NodeBB stores topic ids in shared topic sets:

- `/recent`, `/top`, and `/popular` are backed by `topics.getSortedTopics`.
- `/unread` and the header unread count are backed by
  `topics.getUnreadTids`.
- Global search is backed by `filter:search.query` providers such as
  `nodebb-plugin-dbsearch`, then filtered through NodeBB post/topic privilege
  checks.

Assessment, 2026-04-30:

- Current NodeBB source exposes `filter:topics.updateRecent` in
  `src/topics/recent.js`. Returning a falsey or incomplete payload prevents a
  topic from being added to the global `topics:recent` sorted set. This is the
  best low-cost way to keep future wiki edits and replies out of `/recent`.
- Current NodeBB source exposes `filter:topics.filterSortedTids` in
  `src/topics/sorted.js` after normal privilege, ignored-topic, category, tag,
  and user-block filtering. This is the best presentation filter for existing
  wiki topics already present in `topics:recent`, and for `/top` and
  `/popular`, which use the same sorted-topic pipeline.
- Current NodeBB source exposes `filter:topics.getUnreadTids` in
  `src/topics/unread.js` after unread candidate calculation and before counts
  are returned. This hook can remove wiki topics from all unread filters and
  recompute counts so the `/unread` page and header unread count agree.
- Current NodeBB source exposes `filter:search.inContent` and
  `filter:search.contentGetResult` in `src/search.js`. For global forum search
  hiding, `filter:search.inContent` is the safest generic post-id filter
  because it runs after privilege filtering and before pagination/result
  rendering.
- Bundled `nodebb-plugin-dbsearch` already supports an ACP
  `excludeCategories` list and also fires `filter:search.indexTopics` and
  `filter:search.indexPosts` before writing its index. If dbsearch remains the
  active search provider, wiki categories can be excluded either by syncing its
  configuration or by filtering those indexing hook payloads. The generic
  global-search filter is still needed for non-dbsearch providers.

Ownership decision:

- This plugin owns deciding which category ids are wiki namespaces through
  `config.getSettings().effectiveCategoryIds`.
- This plugin should hide wiki topics from forum-owned global activity surfaces
  by filtering topic ids, not by changing NodeBB category privileges. Category
  permissions remain the source of truth for whether a user may read or edit a
  wiki page.
- `/topic/:slug` should remain reachable for direct discussion access unless a
  later product decision explicitly disables it. The separation goal is to keep
  wiki content out of forum discovery surfaces, not to make wiki topics
  unreadable.
- Wiki-owned search should be implemented as a `/wiki` feature that searches
  only effective wiki namespaces. It should not depend on main forum search
  including wiki categories.

Implementation status, 2026-04-30:

- `lib/forum-exclusion-service.js` centralizes effective wiki cid checks and
  ordered tid/pid filtering through NodeBB topic/post APIs.
- Plugin startup removes current wiki topic ids from the global
  `topics:recent` sorted set, and the update hook removes wiki tids again if a
  future edit/reply attempts to re-add them.
- `lib/filter-forum-feeds.js` now handles:
  - `filter:topics.updateRecent`
  - `filter:topics.filterSortedTids`
  - `filter:topics.getUnreadTids`
- `lib/filter-forum-search.js` now handles:
  - `filter:search.inContent`
  - `filter:search.indexTopics`
  - `filter:search.indexPosts`
- `plugin.json` registers those hooks, so deployment requires a NodeBB restart;
  no asset rebuild is required for the server-side hook changes alone.
- `npm test` passed after the hook implementation.
- No NodeBB core files were changed.
- Known remaining gap: `/api/recent/posts` and `/recentposts.rss` call
  `posts.getRecentPosts`, and current NodeBB source does not expose a clean
  plugin hook in that method. The startup `topics:recent` cleanup does not
  affect the global `posts:pid` set. Avoid monkey-patching for the first
  shippable pass; if those surfaces matter in production, propose a small
  NodeBB core hook after `privileges.posts.filter` and before
  `getPostSummaryByPids`, or add a carefully-scoped route/controller wrapper as
  a separate task.

### Phase 0: Confirm Surface Inventory

Goal:
Identify every global forum surface that currently leaks wiki topics before
adding filters.

Tasks:

1. Verify `/categories` and direct `/category/:cid` behavior still uses
   `filter:categories.build` and `filter:category.build` as expected.
2. Check `/recent`, `/top`, `/popular`, `/unread`, header unread count,
   `/recent.rss`, `/recentposts.rss`, and main `/search`.
3. Record whether the active production search provider is bundled dbsearch,
   Elasticsearch, Solr, or another plugin.
4. Capture a test wiki topic id and category id, then confirm where that topic
   appears before filtering.

Exit criteria:

- The leak surfaces are known and split into topic-list, unread, feed, and
  search categories.
- The active search provider and its hook behavior are known.

### Phase 1: Add A Shared Forum-Exclusion Service

Goal:
Avoid duplicating category checks across hooks.

Tasks:

1. Add a plugin-owned helper, for example `lib/forum-exclusion-service.js`.
2. Reuse `config.getSettings().effectiveCategoryIds` and expose:
   - `getWikiCidSet()`
   - `isWikiCid(cid)`
   - `filterNonWikiTopics(topicData)`
   - `filterNonWikiTids(tids, uid)`
   - `filterNonWikiPids(pids, uid)`
3. Use NodeBB APIs (`topics.getTopicsFields`, `posts.getPostsFields`) for cid
   lookups instead of direct database assumptions.
4. Preserve input ordering and tolerate missing/deleted topics or posts.
5. Treat missing config as no filtering.

Exit criteria:

- All future feed/search hooks can use one helper to remove wiki-backed forum
  content.

### Phase 2: Hide Wiki Topics From Recent, Top, And Popular

Goal:
Keep wiki topics out of forum topic-list discovery.

Tasks:

1. Register `filter:topics.updateRecent` and return no `tid`/`timestamp` when
   the topic's cid is a wiki cid.
2. Register `filter:topics.filterSortedTids` and remove wiki topic ids from
   `data.tids`.
3. Keep filtering conditional: if `params.cids` explicitly targets a wiki cid
   through a core forum route, prefer redirecting the category route to `/wiki`
   rather than returning mixed behavior.
4. Remove existing wiki tids from `topics:recent` on plugin startup, and keep
   the cleanup idempotent so restarts are safe.
5. Re-run topic creation, reply, edit, and move flows to ensure a topic moved
   into a wiki category disappears from forum lists, and a topic moved out of a
   wiki category can appear again.

Exit criteria:

- New wiki topics and replies do not enter `/recent`.
- Existing wiki topics are filtered out of `/recent`, `/top`, and `/popular`.
- Forum topics outside wiki namespaces are unaffected.

### Phase 3: Hide Wiki Topics From Unread

Goal:
Make `/unread` and unread counts ignore wiki-backed topics.

Tasks:

1. Register `filter:topics.getUnreadTids`.
2. Remove wiki tids from `data.tids`.
3. Remove wiki tids from every `data.tidsByFilter` array.
4. Recompute `data.counts` from the filtered `tidsByFilter` values.
5. Remove wiki cids from `data.unreadCids`.
6. Verify the hook handles both full unread-list calls and `count: true` calls
   used by `topics.getTotalUnread` and `topics.pushUnreadCount`.
7. Decide whether opening a wiki page should mark its backing topic read. If
   not, unread filtering must remain permanent so hidden unread wiki topics do
   not keep inflating header counters.

Exit criteria:

- Wiki topics do not appear on `/unread`.
- Header unread counts do not include wiki topics.
- Mark-all-read behavior for forums remains unchanged.

### Phase 4: Hide Wiki Content From Main Search

Goal:
Keep global forum search scoped to forum content while leaving room for
wiki-specific search.

Tasks:

1. Register `filter:search.inContent` and remove pids whose topic cid is a
   wiki cid from `data.pids`.
2. Do not register `filter:search.filterAndSort` for the first shippable pass:
   merely having a listener forces NodeBB to load matched post/topic metadata
   during relevance searches. Add it only if a provider-specific ordering path
   is proven to reintroduce wiki posts before `filter:search.inContent`.
3. For bundled dbsearch, register `filter:search.indexTopics` and
   `filter:search.indexPosts` to avoid indexing wiki topic titles and post
   bodies in the main search index.
4. If using dbsearch in production, either:
   - sync its ACP `excludeCategories` with wiki effective cids, or
   - keep the plugin-side indexing filters authoritative and trigger a dbsearch
     reindex after deployment.
5. For Elasticsearch/Solr providers, confirm whether they expose equivalent
   indexing hooks or honor `filter:search.query` cid restrictions. If not,
   rely on `filter:search.inContent` for result hiding and document that index
   storage may still contain wiki content until provider-specific exclusion is
   added.
6. Keep `filter:topic.search` behavior in mind: in-topic search inside a wiki
   discussion should either be allowed as direct topic functionality or routed
   to a wiki-owned search UI.

Exit criteria:

- Main forum search does not return wiki posts or wiki topic-title matches.
- Existing search index contents are either purged/reindexed or filtered at
  query time until a reindex is completed.
- The chosen behavior for direct in-topic search is documented.

### Phase 5: Add Wiki-Owned Search

Goal:
Replace main-search visibility with an intentional `/wiki` search surface.

Tasks:

1. Add a wiki search route or API under `/wiki/search` or
   `/api/westgate-wiki/search`.
2. Search only `effectiveCategoryIds`.
3. Return canonical wiki article and namespace URLs, not `/topic/...` URLs.
4. Preserve NodeBB category/topic read privileges for each result.
5. Prefer first-post/article-body results for MVP, then add namespace and title
   ranking after the basic flow works.
6. Add a search input to wiki templates only after the backend result shape is
   stable.

Exit criteria:

- Users can find wiki content from the wiki UI.
- Main forum search remains forum-only.

### Phase 6: Feed And API Follow-Up

Goal:
Close non-page leaks after the primary surfaces are handled.

Tasks:

1. Check `/recent.rss`; it uses recent topic data and may be covered by
   `filter:topics.filterSortedTids`.
2. Check `/recentposts.rss`; it uses recent posts and may need a post/pid
   filter or a small NodeBB hook if none exists.
3. Check `/api/recent`, `/api/unread`, and any mobile/client consumers of the
   same controllers.
4. Check widgets or plugins that call `topics.getLatestTopics` directly,
   because that helper reads `topics:recent` without the sorted-topic filter.
   If needed, add cleanup of `topics:recent` and propose a NodeBB hook for
   `getLatestTopics`.

Exit criteria:

- RSS/API/widget surfaces do not leak wiki topics in normal operation.
- Any remaining core hook gap is documented with the smallest proposed NodeBB
  change.

### Phase 7: Verification

Run these checks before considering forum/wiki feed separation complete:

1. Create a normal forum topic and a wiki topic; only the normal topic appears
   in `/recent`.
2. Reply to a wiki topic; it still does not appear in `/recent`.
3. `/top` and `/popular` do not show wiki topics.
4. `/unread` and the header unread count exclude unread wiki topics.
5. A user with direct wiki permissions can still open the wiki article and its
   `/topic/...` discussion link.
6. Main `/search` does not return wiki title or body matches.
7. Wiki search returns wiki title/body matches with canonical `/wiki` links.
8. Moving a topic into a wiki namespace removes it from forum discovery after
   the next relevant update/reindex.
9. Moving a topic out of a wiki namespace allows it to participate in forum
   discovery again.
10. Rebuild NodeBB assets only if templates/client assets change; restart
    NodeBB after changing `plugin.json` hooks or server-side hook handlers.

## Deferred Work

These items are intentionally out of initialization scope unless the project explicitly expands:

- Infobox or template systems
- API publishing endpoints
- Search indexing
- Compare or revert views
- Custom editor workflows
- Wiki-only namespaces created directly from plugin ACP
- Hiding wiki namespaces from standard forum category surfaces without breaking NodeBB assumptions
- Full DokuWiki-style sidebar/tree navigation
- Semantic section-level revision storage beyond NodeBB's patch history

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
- Forum/wiki feed separation now hides wiki topics from `/recent`, `/top`,
  `/popular`, `/unread`, unread counts, and main search results through
  plugin-owned NodeBB hooks.

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
- [x] Wiki topic ids are filtered out of forum sorted-topic discovery through
  `filter:topics.updateRecent` and `filter:topics.filterSortedTids`.
- [x] Existing wiki topic ids are removed from `topics:recent` during plugin
  startup so direct recent-set consumers are less likely to leak wiki topics.
- [x] Wiki topic ids are filtered out of unread lists and unread-count buckets
  through `filter:topics.getUnreadTids`.
- [x] Wiki post ids are filtered out of main forum search result rendering
  through `filter:search.inContent`.
- [x] Wiki topics/posts are filtered from bundled dbsearch indexing through
  `filter:search.indexTopics` and `filter:search.indexPosts`.

## Pending Steps

- [x] Add operational scripts or documented manual checks.
- [ ] Restart the live NodeBB server after deploying the forum/wiki feed
  separation hook changes in `plugin.json`.
- [ ] Manually verify `/recent`, `/top`, `/popular`, `/unread`, header unread
  count, and main `/search` on the live server with at least one normal topic
  and one wiki topic.
- [ ] If dbsearch is the live search provider, run a search reindex when
  convenient so wiki content is removed from the stored search index, not only
  filtered from result rendering.
- [ ] Decide whether `/api/recent/posts` and `/recentposts.rss` need a NodeBB
  core hook or separate wrapper to filter recent post summaries from wiki
  categories.
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
  - [x] Follow-up article media pass updated `public/wiki-article-body.css`
    with neutral image figure hooks and shrink-to-content centered figure
    layout so captions stay contained with their images, while direct
    article-child image paragraphs are centered without interfering with custom
    div/flexbox image layouts.
  - [x] `npm test` and `./nodebb build` still succeed after the article media
    pass.
  - [x] Follow-up article container pass tightened
    `nodebb-theme-westgate/scss/westgate/_wiki-prose.scss` so the article body
    card, sidebar table of contents, and sidebar navigation panels resolve to
    the same Westgate velvet surface, border, radius, shadow, and font stacks
    used by forum category containers.
  - [x] Local Playwright computed-style check confirmed the wiki body, TOC,
    and navigation cards match the forum category container surface tokens.
  - [x] Follow-up CKEditor form/dialog pass added global wiki-composer rules
    for body-mounted CKEditor forms plus explicit find/replace overrides so
    headers, labels, counters, inputs, placeholders, disabled states, and action
    buttons inherit Westgate dark panels and UI fonts.
  - [x] `./nodebb build` still succeeds after the CKEditor form/dialog pass.
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
