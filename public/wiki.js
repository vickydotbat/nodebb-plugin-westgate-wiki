"use strict";

$(document).ready(function () {
  let pendingWikiCreate = null;
  let pendingAutoCreateHref = null;

  function clearPendingWikiCreate() {
    pendingWikiCreate = null;
  }

  function buildCurrentPathWithoutQuery() {
    return `${window.location.pathname}${window.location.hash || ""}`;
  }

  function getCreateIntentFromUrl(urlValue) {
    let url;

    try {
      url = new URL(urlValue, window.location.origin);
    } catch (err) {
      return null;
    }

    if (url.origin !== window.location.origin || !url.pathname.includes("/wiki/category/")) {
      return null;
    }

    const title = (url.searchParams.get("create") || "").trim();
    const cidMatch = url.pathname.match(/\/wiki\/category\/(\d+)(?:\/|$)/);
    const cid = cidMatch ? parseInt(cidMatch[1], 10) : NaN;

    if (!title || !Number.isInteger(cid) || cid <= 0) {
      return null;
    }

    return {
      cid: cid,
      title: title,
      href: url.toString(),
      isRedlink: url.searchParams.get("redlink") === "1"
    };
  }

  function launchWikiCreate(intent) {
    if (!intent || !Number.isInteger(intent.cid) || intent.cid <= 0) {
      return false;
    }

    pendingWikiCreate = {
      cid: intent.cid,
      title: intent.title || ""
    };

    let target = `wiki/compose/${intent.cid}`;
    if (intent.title) {
      target += `?title=${encodeURIComponent(intent.title)}`;
    }

    if (typeof ajaxify !== "undefined" && typeof ajaxify.go === "function") {
      ajaxify.go(target);
      return true;
    }

    const rel = (window.config && window.config.relative_path) || "";
    const base = rel.endsWith("/") ? rel.slice(0, -1) : rel;
    window.location.href = `${base}/${target}`;
    return true;
  }

  function maybeOpenCreateFromLocation() {
    const intent = getCreateIntentFromUrl(window.location.href);

    if (!intent || pendingAutoCreateHref === intent.href) {
      return;
    }

    pendingAutoCreateHref = intent.href;
    window.history.replaceState(window.history.state, document.title, buildCurrentPathWithoutQuery());
    launchWikiCreate(intent);
  }

  function maybeOpenCreateFromMarkup() {
    const autoloadLink = $("[data-wiki-create-autoload]").first();

    if (!autoloadLink.length) {
      return;
    }

    const cid = parseInt(autoloadLink.attr("data-cid"), 10);
    const title = (autoloadLink.attr("data-title") || "").trim();
    const marker = `${cid}:${title}`;

    if (!title || pendingAutoCreateHref === marker) {
      return;
    }

    pendingAutoCreateHref = marker;
    launchWikiCreate({ cid: cid, title: title });
  }

  function markRedLinks() {
    $(".westgate-wiki a").each(function () {
      const intent = getCreateIntentFromUrl($(this).attr("href"));

      if (intent && intent.isRedlink) {
        $(this).addClass("wiki-redlink");
      }
    });
  }

  function handleWikiCreateLinkClick(event) {
    const link = event.target && event.target.closest ? event.target.closest("a") : null;
    const intent = link ? getCreateIntentFromUrl(link.getAttribute("href")) : null;

    if (!intent) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    pendingAutoCreateHref = intent.href;
    launchWikiCreate(intent);
  }

  require(
    ["hooks"],
    function (hooks) {
    hooks.on("filter:composer.topic.push", function (payload) {
      if (
        payload &&
        payload.data &&
        payload.data._wikiCreate &&
        payload.pushData
      ) {
        payload.pushData._wikiCreate = true;
      }

      return payload;
    });

    hooks.on("filter:composer.submit", function (payload) {
      if (
        payload &&
        payload.action === "topics.post" &&
        payload.composerData &&
        (pendingWikiCreate || (payload.postData && payload.postData._wikiCreate))
      ) {
        payload.redirect = false;
        payload.composerData._wikiRedirect = true;
      }

      return payload;
    });

    hooks.on("action:composer.topics.post", function (payload) {
      if (
        payload &&
        payload.composerData &&
        payload.composerData._wikiRedirect &&
        payload.data &&
        payload.data.slug
      ) {
        pendingAutoCreateHref = null;
        clearPendingWikiCreate();
        ajaxify.go(`wiki/${payload.data.slug}`);
      }
    });

    hooks.on("action:composer.discard", function (payload) {
      if (!payload || !payload.postData || !payload.postData.submitted) {
        clearPendingWikiCreate();
      }
    });

    hooks.on("action:ajaxify.end", function () {
      markRedLinks();
      maybeOpenCreateFromLocation();
      maybeOpenCreateFromMarkup();
    });
    },
    function (err) {
      if (window.console && console.error) {
        console.error("westgate-wiki: could not load hooks", err);
      }
    }
  );

  $(document).on("click", "[data-wiki-create-page]", function (event) {
    const cid = parseInt($(this).attr("data-cid"), 10);
    const title = ($(this).attr("data-title") || "").trim();

    event.preventDefault();
    launchWikiCreate({ cid: cid, title: title });
  });

  $(document).on("click", "a", function (event) {
    const intent = getCreateIntentFromUrl($(this).attr("href"));

    if (!intent) {
      return;
    }

    event.preventDefault();
    pendingAutoCreateHref = intent.href;
    launchWikiCreate(intent);
  });

  document.addEventListener("click", handleWikiCreateLinkClick, true);

  markRedLinks();
  maybeOpenCreateFromLocation();
  maybeOpenCreateFromMarkup();

  function getCsrfToken() {
    if (window.config && window.config.csrf_token) {
      return String(window.config.csrf_token);
    }
    return "";
  }

  $(document).on("click", "[data-wiki-delete-topic]", async function (event) {
    const btn = event.currentTarget;
    const tid = parseInt(btn.getAttribute("data-tid"), 10);
    const redirectHref = btn.getAttribute("data-redirect-href") || "";

    if (!Number.isInteger(tid) || tid <= 0) {
      return;
    }

    event.preventDefault();

    if (!window.confirm("Remove this wiki page? The topic will be purged (hard delete) and CANNOT be restored.")) {
      return;
    }

    const rel = (window.config && window.config.relative_path) || "";
    const base = rel.endsWith("/") ? rel.slice(0, -1) : rel;
    const url = `${base}/api/v3/topics/${tid}/state`;
    const csrf = getCsrfToken();

    btn.disabled = true;

    try {
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "x-csrf-token": csrf
        }
      });
      let body = null;
      const ct = res.headers.get("content-type");
      if (ct && ct.includes("application/json")) {
        try {
          body = await res.json();
        } catch (parseErr) {
          body = null;
        }
      }

      if (!res.ok) {
        const msg = (body && body.status && body.status.message) || res.statusText;
        throw new Error(msg);
      }

      if (redirectHref) {
        window.location.href = redirectHref;
      } else {
        window.location.href = `${base}/wiki`;
      }
    } catch (err) {
      btn.disabled = false;
      if (typeof app !== "undefined" && app.alert) {
        app.alert({
          type: "error",
          title: "Could not remove page",
          message: (err && err.message) || String(err)
        });
      } else {
        window.alert((err && err.message) || String(err));
      }
    }
  });
});
