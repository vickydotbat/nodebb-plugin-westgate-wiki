/* global ajaxify */
"use strict";

(function wikiSearchClient() {
  if (typeof window === "undefined" || !window.document) {
    return;
  }

  var DEBOUNCE_MS = 220;

  function relBase() {
    return (window.config && window.config.relative_path) || "";
  }

  function apiUrl(params) {
    var base = relBase().replace(/\/$/, "");
    var url = new URL(base + "/api/v3/plugins/westgate-wiki/search", window.location.origin);
    Object.keys(params || {}).forEach(function (key) {
      var value = params[key];
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  }

  function searchPageUrl(query) {
    var base = relBase().replace(/\/$/, "");
    var url = new URL(base + "/wiki/search", window.location.origin);
    if (query) {
      url.searchParams.set("q", query);
    }
    return url.pathname + url.search;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function responsePayload(body) {
    return body && body.response ? body.response : (body || {});
  }

  function resultTitle(row) {
    return row.type === "namespace" ? (row.title || row.titleLeaf || "") : (row.titleLeaf || row.title || "");
  }

  function renderSuggestionRow(row) {
    var meta = row.type === "namespace" ? (row.wikiPath || "") : (row.namespaceTitle || row.namespacePath || "");
    var icon = row.type === "namespace" ? "fa-folder-open" : "fa-file-text-o";
    return [
      '<li class="wiki-search-suggestions__item">',
      '<a class="wiki-search-suggestions__link" href="', escapeHtml(relBase() + (row.wikiPath || "")), '">',
      '<i class="fa ', icon, '" aria-hidden="true"></i>',
      '<span class="wiki-search-suggestions__title">', escapeHtml(resultTitle(row)), '</span>',
      '<span class="wiki-search-suggestions__meta">', escapeHtml(meta), '</span>',
      "</a>",
      "</li>"
    ].join("");
  }

  function renderSuggestions(form, payload, query) {
    var box = form.querySelector("[data-wiki-search-suggestions]");
    var status = form.querySelector("[data-wiki-search-status]");
    var list = form.querySelector("[data-wiki-search-results]");
    var all = form.querySelector("[data-wiki-search-all]");
    var results = payload.results || [];

    if (!box || !status || !list) {
      return;
    }

    if (!query) {
      box.hidden = true;
      list.innerHTML = "";
      status.textContent = "";
      return;
    }

    box.hidden = false;
    if (payload.queryTooShort) {
      status.textContent = "Keep typing...";
      list.innerHTML = "";
    } else if (!results.length) {
      status.textContent = "No wiki results";
      list.innerHTML = "";
    } else {
      status.textContent = "";
      list.innerHTML = results.map(renderSuggestionRow).join("");
    }

    if (all) {
      all.href = searchPageUrl(query);
      all.hidden = !query;
      all.textContent = "View all results";
    }
  }

  function renderPageGroup(title, rows) {
    if (!rows || !rows.length) {
      return "";
    }
    return [
      '<section class="wiki-search-results__group">',
      "<h2>", escapeHtml(title), "</h2>",
      '<ul class="wiki-search-results__list">',
      rows.map(function (row) {
        var meta = row.type === "namespace" ? (row.wikiPath || "") : (row.namespaceTitle || row.namespacePath || "");
        return [
          '<li class="wiki-search-result wiki-search-result--', escapeHtml(row.type || "page"), '">',
          '<a class="wiki-search-result__title" href="', escapeHtml(relBase() + (row.wikiPath || "")), '">',
          escapeHtml(resultTitle(row)),
          "</a>",
          '<span class="wiki-search-result__meta">', escapeHtml(meta), "</span>",
          "</li>"
        ].join("");
      }).join(""),
      "</ul>",
      "</section>"
    ].join("");
  }

  function renderPageResults(page, payload, query) {
    var status = page.querySelector("[data-wiki-search-page-status]");
    var host = page.querySelector("[data-wiki-search-page-results]");
    var groups = payload.groups || {};

    if (!host) {
      return;
    }

    if (status) {
      status.textContent = "";
    }

    if (!query) {
      host.innerHTML = '<article class="wiki-status-card card"><div class="card-body"><h2>Search for wiki pages and namespaces</h2><p class="mb-0">Type a page title, title path, or namespace name to search the readable wiki.</p></div></article>';
      return;
    }
    if (payload.queryTooShort) {
      host.innerHTML = '<article class="wiki-status-card card"><div class="card-body"><h2>Keep Typing</h2><p class="mb-0">Use at least two characters to search the wiki.</p></div></article>';
      return;
    }
    if (payload.isConfigured === false) {
      host.innerHTML = '<article class="wiki-status-card card"><div class="card-body"><h2>Wiki Search Unavailable</h2><p class="mb-0">No wiki namespaces are configured yet.</p></div></article>';
      return;
    }
    if (payload.isConfigured === true && payload.hasReadableNamespaces === false) {
      host.innerHTML = '<article class="wiki-status-card card"><div class="card-body"><h2>No Readable Wiki Namespaces</h2><p class="mb-0">There are no wiki namespaces available to your account.</p></div></article>';
      return;
    }
    if (!payload.totalReturned) {
      host.innerHTML = '<article class="wiki-status-card card"><div class="card-body"><h2>No Results</h2><p class="mb-0">No readable wiki pages or namespaces matched <strong>' + escapeHtml(query) + "</strong>.</p></div></article>";
      return;
    }

    host.innerHTML = [
      '<div class="wiki-search-results">',
      renderPageGroup("Exact Matches", groups.exact || []),
      renderPageGroup("Pages", groups.pages || []),
      renderPageGroup("Namespaces", groups.namespaces || []),
      "</div>"
    ].join("");
  }

  function fetchSearch(params) {
    return fetch(apiUrl(params), { credentials: "same-origin" })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) {
            var msg = body && body.status && body.status.message || res.statusText;
            throw new Error(msg);
          }
          return responsePayload(body);
        });
      });
  }

  function bindForm(form) {
    if (!form || form.getAttribute("data-wiki-search-ready") === "1") {
      return;
    }
    form.setAttribute("data-wiki-search-ready", "1");

    var input = form.querySelector("[data-wiki-search-input]");
    var suggestions = form.querySelector("[data-wiki-search-suggestions]");
    var page = document.querySelector("[data-wiki-search-page]");
    var timer = null;
    var suggestSeq = 0;
    var pageSeq = 0;

    if (!input) {
      return;
    }

    function closeSuggestions() {
      if (suggestions) {
        suggestions.hidden = true;
      }
    }

    function updateSuggestions(query) {
      var seq = ++suggestSeq;
      var status = form.querySelector("[data-wiki-search-status]");
      if (status && query) {
        status.textContent = "Searching...";
      }
      fetchSearch({ q: query, mode: "suggest", limit: 10 })
        .then(function (payload) {
          if (seq !== suggestSeq) {
            return;
          }
          renderSuggestions(form, payload, query);
        })
        .catch(function (err) {
          if (seq !== suggestSeq) {
            return;
          }
          if (status) {
            status.textContent = err && err.message ? err.message : String(err);
          }
          if (suggestions) {
            suggestions.hidden = false;
          }
        });
    }

    function updatePage(query) {
      if (!page) {
        return;
      }
      var seq = ++pageSeq;
      var status = page.querySelector("[data-wiki-search-page-status]");
      if (status) {
        status.textContent = query ? "Searching..." : "";
      }
      fetchSearch({ q: query, mode: "full", limit: 20 })
        .then(function (payload) {
          if (seq !== pageSeq) {
            return;
          }
          renderPageResults(page, payload, query);
        })
        .catch(function (err) {
          if (seq !== pageSeq || !status) {
            return;
          }
          status.textContent = err && err.message ? err.message : String(err);
        });
    }

    function scheduleSearch() {
      var query = input.value.trim();
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        if (!query) {
          closeSuggestions();
          renderPageResults(page || document, { totalReturned: 0 }, "");
          return;
        }
        updateSuggestions(query);
        updatePage(query);
      }, DEBOUNCE_MS);
    }

    input.addEventListener("input", scheduleSearch);
    input.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeSuggestions();
      }
    });

    document.addEventListener("click", function (event) {
      if (!form.contains(event.target)) {
        closeSuggestions();
      }
    });
  }

  function scan(root) {
    (root || document).querySelectorAll("[data-wiki-search-form]").forEach(bindForm);
  }

  function init() {
    scan(document);
  }

  window.westgateWikiSearch = {
    scan: scan
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  if (typeof window.jQuery !== "undefined" && window.jQuery.fn) {
    window.jQuery(window).on("action:ajaxify.end", function () {
      window.setTimeout(function () {
        scan(document);
      }, 0);
    });
  }
}());
