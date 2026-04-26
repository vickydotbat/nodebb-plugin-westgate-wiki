"use strict";

const path = require("path");

const publicDir = path.join(__dirname, "..", "public");

const FILES = {
  "article-body.css": {
    rel: "wiki-article-body.css",
    type: "text/css; charset=utf-8"
  },
  "vendor.css": {
    rel: path.join("vendor", "ckeditor5", "wiki-ckeditor.css"),
    type: "text/css; charset=utf-8"
  },
  "vendor.js": {
    rel: path.join("vendor", "ckeditor5", "wiki-ckeditor.bundle.js"),
    type: "application/javascript; charset=utf-8"
  },
  "page.js": {
    rel: "wiki-compose-page.js",
    type: "application/javascript; charset=utf-8"
  }
};

/**
 * Serves wiki compose JS/CSS from a URL namespace outside /assets/plugins/… so
 * NodeBB’s default service worker (cache-first for GETs) is less likely to
 * return a stale or bad match for plugin static paths after rebuilds.
 */
function register(router) {
  const base = "/westgate-wiki/compose";

  Object.entries(FILES).forEach(([slug, meta]) => {
    const absPath = path.join(publicDir, meta.rel);

    router.get(`${base}/${slug}`, function (req, res, next) {
      res.type(meta.type);
      res.set("Cache-Control", "public, max-age=604800");
      res.sendFile(absPath, (err) => {
        if (err) {
          next(err);
        }
      });
    });
  });
}

module.exports = {
  register
};
