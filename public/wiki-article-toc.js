/* Westgate wiki: in-page table of contents. Thrown errors reject ajaxify script load. */
(function initWikiArticleToc() {
  "use strict";
  if (typeof window === "undefined" || !window.document) {
    return;
  }
  const HEADING_SEL = "h1, h2, h3, h4, h5, h6";
  /** Cap headings processed for ToC to avoid freezing the browser on pathological pages. */
  const MAX_TOC_HEADINGS = 200;
  const ROOT_ARTICLE = "article.wiki-page-content.wiki-article-prose";
  const BODY = ".card-body";
  const ATTR_ROOT = "data-wiki-article-toc-root";
  const ATTR_MOUNT = "data-wiki-article-toc";

  function textToSlug(s) {
    var t = String(s || "")
      .trim()
      .toLowerCase();
    if (typeof t.normalize === "function") {
      t = t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    }
    return t
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function ensureHeadingIds(headings) {
    const used = new Set();
    headings.forEach((h) => {
      if (h.id) {
        used.add(h.id);
      }
    });

    headings.forEach((h) => {
      if (h.id) {
        h.classList.add("wiki-article-toc__heading");
        return;
      }
      const base = textToSlug(h.textContent || "");
      const b = base || "section";
      let k = 0;
      let candidate;
      do {
        candidate = k === 0 ? b : b + "-" + (k + 1);
        k += 1;
      } while (used.has(candidate) && k < 5000);
      h.id = candidate;
      used.add(candidate);
      h.classList.add("wiki-article-toc__heading");
    });
  }

  function buildNestedList(headings) {
    if (!headings.length) {
      return null;
    }

    const root = document.createElement("ol");
    root.className = "wiki-article-toc__ol";

    const stack = [{ list: root, hLevel: 0 }];

    for (let i = 0; i < headings.length; i += 1) {
      const h = headings[i];
      const level = parseInt(h.tagName[1], 10);
      if (!Number.isFinite(level) || level < 1) {
        continue;
      }

      while (stack.length > 1 && stack[stack.length - 1].hLevel >= level) {
        stack.pop();
      }

      const { list: parentList } = stack[stack.length - 1];
      const li = document.createElement("li");
      li.className = "wiki-article-toc__item";
      li.dataset.wikiTocLevel = String(level);

      const a = document.createElement("a");
      a.className = "wiki-article-toc__link";
      a.setAttribute("href", "#" + h.id);
      a.textContent = (h.textContent || "").replace(/\s+/g, " ").trim();
      li.appendChild(a);
      parentList.appendChild(li);

      const next = headings[i + 1];
      const nextLevel = next ? parseInt(next.tagName[1], 10) : 0;
      if (next && nextLevel > level) {
        const sub = document.createElement("ol");
        sub.className = "wiki-article-toc__ol wiki-article-toc__ol--nest";
        li.appendChild(sub);
        stack.push({ list: sub, hLevel: level });
      }
    }

    return root;
  }

  function bindTocSmoothScroll(tocMount) {
    if (!tocMount || tocMount.dataset.wikiTocSmoothBound === "1") {
      return;
    }
    tocMount.dataset.wikiTocSmoothBound = "1";
    tocMount.addEventListener("click", function onTocLinkClick(ev) {
      const anchor = ev.target && ev.target.closest
        ? ev.target.closest("a.wiki-article-toc__link")
        : null;
      if (!anchor || !tocMount.contains(anchor)) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.charAt(0) !== "#") {
        return;
      }
      const id = decodeURIComponent(href.slice(1));
      if (!id) {
        return;
      }
      let target;
      try {
        target = document.getElementById(id);
      } catch (eId) {
        return;
      }
      if (!target) {
        return;
      }
      ev.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof history.replaceState === "function") {
        try {
          history.replaceState(null, "", href);
        } catch (eHist) {
          /* ignore */
        }
      }
    });
  }

  function collapseTocOnSmallScreens() {
    if (typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 767px)").matches) {
      return;
    }
    const toc = document.querySelector(
      ".wiki-article-toc--sidebar, .wiki-article-toc--inline"
    );
    const d = toc && toc.querySelector("details");
    if (d) {
      d.open = false;
    }
  }

  function run() {
    const article = document.querySelector(ROOT_ARTICLE);
    if (!article) {
      return;
    }

    const contentRoot = article.querySelector(BODY);
    if (!contentRoot) {
      return;
    }

    const rawAll = [].slice.call(contentRoot.querySelectorAll(HEADING_SEL));
    const truncated = rawAll.length > MAX_TOC_HEADINGS;
    const raw = truncated ? rawAll.slice(0, MAX_TOC_HEADINGS) : rawAll;

    const mount = document.querySelector("[" + ATTR_MOUNT + "]");
    const wrap = document.querySelector("[" + ATTR_ROOT + "]");

    raw.forEach((h) => h.classList.remove("wiki-article-toc__heading"));

    if (!mount || !raw.length) {
      if (wrap) {
        wrap.setAttribute("hidden", "");
        wrap.setAttribute("aria-hidden", "true");
      }
      if (mount) {
        mount.innerHTML = "";
      }
      return;
    }

    ensureHeadingIds(raw);
    const list = buildNestedList(raw);
    mount.innerHTML = "";
    if (truncated) {
      const note = document.createElement("p");
      note.className = "wiki-article-toc__truncated-note small text-muted mb-2";
      note.setAttribute("role", "status");
      note.textContent =
        "Showing the first " +
        MAX_TOC_HEADINGS +
        " headings in this table of contents. The article has more headings.";
      mount.appendChild(note);
    }
    if (list) {
      mount.appendChild(list);
    }
    if (wrap) {
      wrap.removeAttribute("hidden");
      wrap.setAttribute("aria-hidden", "false");
    }
    bindTocSmoothScroll(mount);
    collapseTocOnSmallScreens();
  }

  function scheduleBindAjaxify() {
    var n = 0;
    var maxTries = 200;
    function tryBind() {
      var jQuery = window.jQuery;
      if (jQuery && jQuery.fn) {
        try {
          jQuery(window).on("action:ajaxify.end", function () {
            setTimeout(function () {
              try {
                run();
              } catch (eRun) {
                if (console && console.error) {
                  console.error("wiki-article-toc:run", eRun);
                }
              }
            }, 0);
          });
        } catch (e) {
          if (console && console.error) {
            console.error("wiki-article-toc:bind", e);
          }
        }
        return;
      }
      if (n < maxTries) {
        n += 1;
        setTimeout(tryBind, 25);
      }
    }
    tryBind();
  }

  function start() {
    try {
      run();
    } catch (e) {
      if (console && console.error) {
        console.error("wiki-article-toc:init", e);
      }
    }
    scheduleBindAjaxify();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}());
