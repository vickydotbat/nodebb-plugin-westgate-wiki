# Westgate Wiki Plugin

`nodebb-plugin-westgate-wiki` adds a wiki surface to NodeBB without introducing a second content system. It treats selected NodeBB categories as wiki namespaces and topics inside those categories as wiki pages.

The plugin is deliberately wiki-first in presentation, but it still relies on NodeBB categories, topics, permissions, routing, and the core topic APIs for persistence.

## License

This plugin is distributed under **GPL-3.0-or-later** so it can ship a **CKEditor 5** build under the GPL license key. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `public/vendor/ckeditor5/LICENSE-CKEditor-5.md`.

## Content Model

- Configured categories are wiki namespaces.
- Topics inside those categories are wiki pages.
- The first post is the canonical wiki article body.
- `/wiki/:topic_id/:slug?` is the canonical wiki view.
- `/topic/:slug` remains the discussion thread for the same underlying content.
- NodeBB category permissions remain the source of truth for who can view and create pages.

## What It Currently Does

- Renders a wiki landing page at `/wiki`
- Renders namespace pages at `/wiki/category/:category_id/:slug?`
- Renders wiki article pages at `/wiki/:topic_id/:slug?`
- Lets admins select wiki namespaces from ACP instead of hand-editing raw IDs
- Optionally includes descendant categories automatically as nested namespaces
- Shows ancestor breadcrumbs and namespace-local navigation
- Exposes `Create Page` and redlink flows via **`/wiki/compose/:cid`** using a **CKEditor 5** rich editor (GPL), including **Paste Markdown** for legacy Markdown, **HTML → GFM Markdown** on save, and image upload to NodeBB’s **`POST /api/post/upload`**
- Optional namespace topic search API: **`GET /api/v3/plugins/westgate-wiki/namespace/:cid/search?q=`** for the compose “insert wiki link” helper
- Supports first-pass internal wiki links:
  - `[[Page Title]]`
  - `[[Child Namespace/Page Title]]`
  - `[[Root Namespace/Child Namespace/Page Title]]`
  - `[[Target|Custom Label]]`
- Treats unresolved internal links as wiki redlinks that open prefilled page creation in the target namespace

## How To Use It

1. Install and activate the plugin in a NodeBB instance.
2. Open `ACP > Plugins > Westgate Wiki`.
3. Select the categories that should behave as wiki namespaces.
4. Decide whether descendant categories should automatically count as wiki namespaces.
5. Visit `/wiki`.

Practical structure:

- top-level configured categories: top-level wiki namespaces
- configured child categories: nested namespaces
- topics inside a namespace category: pages in that namespace

If you want some wiki areas to be restricted, use normal NodeBB category privileges for those categories. The plugin respects them.

## Authoring Notes

Wiki pages are still NodeBB topics. That means:

- creating a page uses the wiki compose editor and **`POST /api/v3/topics`** (same data model as the forum composer)
- editing article content still means editing the first post (compose editor is create-only for now)
- discussion replies still live in the underlying topic thread

Internal links are resolved against wiki namespaces, not forum routes. Missing targets become redlinks. Clicking a redlink opens a prefilled page create flow in the target namespace.

## Development

### Repository Shape

The plugin is intentionally split by responsibility:

- [library.js](/home/vicky/Projects/nodebb-dev/nodebb-plugin-westgate-wiki/library.js): plugin entrypoint and exported service surface
- [routes/wiki.js](/home/vicky/Projects/nodebb-dev/nodebb-plugin-westgate-wiki/routes/wiki.js): wiki route registration
- [lib/config.js](/home/vicky/Projects/nodebb-dev/nodebb-plugin-westgate-wiki/lib/config.js): settings loading and effective namespace expansion
- [lib/wiki-service.js](/home/vicky/Projects/nodebb-dev/nodebb-plugin-westgate-wiki/lib/wiki-service.js): namespace retrieval and serialization preparation
- [lib/topic-service.js](/home/vicky/Projects/nodebb-dev/nodebb-plugin-westgate-wiki/lib/topic-service.js): wiki page retrieval
- [lib/wiki-links.js](/home/vicky/Projects/nodebb-dev/nodebb-plugin-westgate-wiki/lib/wiki-links.js): internal wiki link parsing and redlink generation
- [lib/serializer.js](/home/vicky/Projects/nodebb-dev/nodebb-plugin-westgate-wiki/lib/serializer.js): wiki path and view-model shaping
- [templates/](/home/vicky/Projects/nodebb-dev/nodebb-plugin-westgate-wiki/templates): wiki-facing templates
- [public/wiki.js](/home/vicky/Projects/nodebb-dev/nodebb-plugin-westgate-wiki/public/wiki.js): client-side create-page and redlink behavior
- [public/wiki.css](/home/vicky/Projects/nodebb-dev/nodebb-plugin-westgate-wiki/public/wiki.css): wiki-scoped styling

### Exposed Service Surface

The plugin entrypoint exposes reusable internals through `require("nodebb-plugin-westgate-wiki").services`:

- `config`
- `serializer`
- `topicService`
- `wikiLinks`
- `wikiService`

That is useful if another local plugin or future extension wants to inspect namespace behavior without duplicating the logic.

### Local Workflow

From the plugin directory:

```bash
npm install
npm run build:ckeditor
npm test
```

The CKEditor bundle is written to `public/vendor/ckeditor5/`. Commit those artifacts or rebuild after dependency upgrades.

From the NodeBB instance:

```bash
./nodebb build
```

Restart NodeBB after changing any of these:

- `plugin.json`
- server-side route registration
- hook registration
- plugin initialization logic

Rebuild is enough for:

- templates
- client-side JS
- CSS

### Manual Verification

Check these flows after meaningful changes:

1. `/wiki` renders only configured top-level namespaces.
2. Namespace pages show child namespaces and recent pages.
3. Wiki article pages render the first post as article content.
4. `Create Page` opens `/wiki/compose/:cid` and a successful publish redirects to `/wiki/:slug`.
5. `Create Sibling Page` still opens the compose route with the sibling namespace `cid` when linked from the article template.
6. Existing `[[...]]` links resolve to `/wiki/...`.
7. Missing `[[...]]` links are styled as redlinks and open creation in the correct namespace.
8. Nested namespace links resolve correctly when written as full paths or unique suffix paths.
9. Namespace visibility matches NodeBB category privileges.

## Troubleshooting

- `/wiki` is empty:
  The selected categories may be empty, unreadable to the current user, or invalid.
- A namespace page 404s:
  Confirm the category is included in the effective wiki namespace set and the URL uses the current category slug.
- A wiki article 404s:
  Confirm the topic belongs to an effective wiki namespace.
- Redlinks look normal:
  The running NodeBB instance is likely serving stale client assets. Rebuild and restart the live process.
- Redlinks open the namespace page but not the compose editor:
  The live process likely did not pick up the new client script or route/template state. Rebuild and restart the actual process serving the site.
- Changes do not appear:
  Rebuild NodeBB assets, then restart the process if the change is server-side or initialization-related.
- Wiki compose: CKEditor scripts/CSS fail with **MIME type “text/plain”** or **NS_ERROR_CORRUPTED_CONTENT** in Firefox:
  Usually the static files are missing from the install (`public/vendor/ckeditor5/` under the plugin) or the URL is wrong. From the plugin repo run **`npm run build:ckeditor`**, confirm those files exist next to `wiki-compose-page.js`, then reinstall/relink the plugin into NodeBB and run **`./nodebb build`**. In templates, do not prefix **`v=`** before `{config.cache-buster}`—that value already includes the `v=` segment when set.
- Wiki compose or article page still looks like **plain CKEditor** (white canvas, default fonts):
  Article typography is **`/westgate-wiki/compose/article-body.css`** (served by the plugin router, same namespace as `vendor.css`). Confirm that URL returns **200** in the browser network tab after **`./nodebb build`** and a process restart. The editable also gets class **`wiki-article-prose`** from JS (`getEditableElement`) plus the **`#wiki-compose-editor`** wrapper in the template.
- **127.0.0.1 vs localhost**: open the forum using the same host as **`url` in `config.json`**. Mixing them breaks websockets, CORP on some plugin assets, and CSRF/session expectations.
