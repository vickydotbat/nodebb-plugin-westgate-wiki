# Westgate Wiki Plugin

`nodebb-plugin-westgate-wiki` adds a wiki surface to NodeBB without introducing a second content system. It treats selected NodeBB categories as wiki namespaces and topics inside those categories as wiki pages.

The plugin is deliberately wiki-first in presentation, but it still relies on NodeBB categories, topics, permissions, routing, and the native composer underneath.

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
- Exposes `Create Page` and `Create Sibling Page` actions backed by the native NodeBB composer
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

- creating a page opens the native composer
- editing article content means editing the first post
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
npm test
```

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
4. `Create Page` lands on the wiki page after successful submit.
5. `Create Sibling Page` lands on the wiki page after successful submit.
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
- Redlinks open the namespace page but not the composer:
  The live process likely did not pick up the new client script or route/template state. Rebuild and restart the actual process serving the site.
- Changes do not appear:
  Rebuild NodeBB assets, then restart the process if the change is server-side or initialization-related.
