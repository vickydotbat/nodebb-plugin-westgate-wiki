# Third-party notices

This plugin bundles or builds against the following major components.

## Tiptap / ProseMirror

- Source: https://github.com/ueberdosis/tiptap
- License: MIT
- Built output is emitted to `public/vendor/tiptap/` by `npm run build:tiptap`

## Turndown and GFM plugin

- Turndown: https://github.com/mixmark-io/turndown (MIT)
- turndown-plugin-gfm: https://github.com/mixmark-io/turndown-plugin-gfm (MIT)

## markdown-it

- https://github.com/markdown-it/markdown-it (MIT) — optional bulk markdown import in the compose UI

## DOMPurify and sanitize-html

- DOMPurify: https://github.com/cure53/DOMPurify (Apache-2.0 or MPL-2.0) — client-side wiki compose sanitization
- sanitize-html: https://github.com/apostrophecms/sanitize-html (MIT) — server-side wiki main-post sanitization

See each package’s `LICENSE` or `package.json` in `node_modules` after `npm install` for full text.
