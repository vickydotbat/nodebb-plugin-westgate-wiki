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
