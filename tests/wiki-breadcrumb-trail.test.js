"use strict";

const assert = require("assert");

const wikiBreadcrumbTrail = require("../lib/wiki-breadcrumb-trail");

function texts(trail) {
  return trail.wikiBreadcrumbs.map((crumb) => crumb.text);
}

assert.deepStrictEqual(
  texts(wikiBreadcrumbTrail.forArticleView({
    ancestorSections: [],
    category: {
      name: "Shadows Over Westgate Wiki",
      wikiPath: "/wiki/shadows-over-westgate-wiki"
    },
    sectionNavigation: {
      wikiPath: "/wiki/shadows-over-westgate-wiki"
    },
    topic: {
      title: "Home"
    }
  })),
  ["Shadows Over Westgate Wiki", "Home"],
  "article breadcrumbs should not include the static wiki root label"
);

assert.deepStrictEqual(
  texts(wikiBreadcrumbTrail.forSectionView({
    ancestorSections: [],
    name: "Shadows Over Westgate Wiki"
  })),
  ["Shadows Over Westgate Wiki"],
  "section breadcrumbs should start with the concrete namespace"
);
