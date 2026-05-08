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

    if (url.origin !== window.location.origin || !url.pathname.includes("/wiki/")) {
      return null;
    }

    const title = (url.searchParams.get("create") || "").trim();
    const cidParam = url.searchParams.get("cid");
    const cidMatch = url.pathname.match(/\/wiki\/category\/(\d+)(?:\/|$)/);
    const cid = cidParam ? parseInt(cidParam, 10) : (cidMatch ? parseInt(cidMatch[1], 10) : NaN);

    if (!title || !Number.isInteger(cid) || cid <= 0) {
      return null;
    }

    return {
      cid: cid,
      title: title,
      namespacePath: url.pathname.replace(((window.config && window.config.relative_path) || ""), "") || url.pathname,
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
      title: intent.title || "",
      namespacePath: intent.namespacePath || ""
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

  function maybeInitComposePage() {
    if (window.westgateWikiInitComposePage) {
      window.westgateWikiInitComposePage();
    }
  }

  const codeHighlightKeywords = {
    bash: [
      "case", "do", "done", "elif", "else", "esac", "fi", "for", "function",
      "if", "in", "local", "return", "select", "then", "until", "while"
    ],
    powershell: [
      "begin", "break", "catch", "class", "continue", "data", "do", "dynamicparam",
      "else", "elseif", "end", "exit", "filter", "finally", "for", "foreach",
      "from", "function", "if", "in", "param", "process", "return", "switch",
      "throw", "trap", "try", "until", "using", "while"
    ],
    csharp: [
      "abstract", "as", "base", "bool", "break", "byte", "case", "catch",
      "char", "checked", "class", "const", "continue", "decimal", "default",
      "delegate", "do", "double", "else", "enum", "event", "explicit", "extern",
      "false", "finally", "fixed", "float", "for", "foreach", "goto", "if",
      "implicit", "in", "int", "interface", "internal", "is", "lock", "long",
      "namespace", "new", "null", "object", "operator", "out", "override",
      "params", "private", "protected", "public", "readonly", "ref", "return",
      "sbyte", "sealed", "short", "sizeof", "stackalloc", "static", "string",
      "struct", "switch", "this", "throw", "true", "try", "typeof", "uint",
      "ulong", "unchecked", "unsafe", "ushort", "using", "virtual", "void",
      "volatile", "while"
    ]
  };

  function normalizeCodeLanguage(value) {
    const key = String(value || "").trim().toLowerCase();
    if (key === "sh" || key === "shell") {
      return "bash";
    }
    if (key === "pwsh" || key === "ps1") {
      return "powershell";
    }
    if (key === "cs" || key === "c#") {
      return "csharp";
    }
    return codeHighlightKeywords[key] ? key : "";
  }

  function getCodeLanguage(code) {
    const classNames = Array.from((code && code.classList) || []);
    const languageClass = classNames.find(function (className) {
      return className.indexOf("language-") === 0;
    });
    return normalizeCodeLanguage(languageClass ? languageClass.slice("language-".length) : "");
  }

  function readQuotedCodeToken(text, start) {
    const quote = text[start];
    let index = start + 1;
    while (index < text.length) {
      if (text[index] === "\\") {
        index += 2;
        continue;
      }
      if (text[index] === quote) {
        return index + 1;
      }
      index += 1;
    }
    return text.length;
  }

  function tokenizeHighlightedCode(text, language) {
    const keywords = new Set(codeHighlightKeywords[language] || []);
    const wordPattern = language === "powershell" ? /-?[A-Za-z_][\w-]*/y : /[A-Za-z_]\w*/y;
    const tokens = [];
    let index = 0;
    while (index < text.length) {
      const char = text[index];
      const next = text[index + 1];
      let end;
      let match;

      if (char === "\"" || char === "'") {
        end = readQuotedCodeToken(text, index);
        tokens.push({ from: index, to: end, type: "string" });
        index = end;
        continue;
      }
      if (language === "csharp" && char === "/" && next === "/") {
        end = text.indexOf("\n", index);
        end = end === -1 ? text.length : end;
        tokens.push({ from: index, to: end, type: "comment" });
        index = end;
        continue;
      }
      if (language === "csharp" && char === "/" && next === "*") {
        end = text.indexOf("*/", index + 2);
        end = end === -1 ? text.length : end + 2;
        tokens.push({ from: index, to: end, type: "comment" });
        index = end;
        continue;
      }
      if ((language === "bash" || language === "powershell") && char === "#") {
        end = text.indexOf("\n", index);
        end = end === -1 ? text.length : end;
        tokens.push({ from: index, to: end, type: "comment" });
        index = end;
        continue;
      }
      if ((language === "bash" || language === "powershell") && char === "$") {
        match = /^\$[{]?[A-Za-z_][\w:.-]*[}]?/.exec(text.slice(index));
        if (match) {
          tokens.push({ from: index, to: index + match[0].length, type: "variable" });
          index += match[0].length;
          continue;
        }
      }
      if (/\d/.test(char)) {
        match = /^\d+(?:\.\d+)?/.exec(text.slice(index));
        if (match) {
          tokens.push({ from: index, to: index + match[0].length, type: "number" });
          index += match[0].length;
          continue;
        }
      }

      wordPattern.lastIndex = index;
      match = wordPattern.exec(text);
      if (match) {
        if (keywords.has(match[0].replace(/^-/, "").toLowerCase())) {
          tokens.push({ from: index, to: index + match[0].length, type: "keyword" });
        }
        index += match[0].length;
        continue;
      }

      index += 1;
    }
    return tokens;
  }

  function highlightCodeElement(code, language) {
    const text = code.textContent || "";
    const tokens = tokenizeHighlightedCode(text, language);
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    tokens.forEach(function (token) {
      if (token.from > cursor) {
        fragment.appendChild(document.createTextNode(text.slice(cursor, token.from)));
      }
      const span = document.createElement("span");
      span.className = `wiki-code-token wiki-code-token--${token.type}`;
      span.textContent = text.slice(token.from, token.to);
      fragment.appendChild(span);
      cursor = token.to;
    });
    if (cursor < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(cursor)));
    }
    code.replaceChildren(fragment);
    code.setAttribute("data-wiki-code-highlighted", "1");
  }

  function highlightReadOnlyWikiCodeBlocks() {
    document.querySelectorAll('.wiki-article-prose pre code[class*="language-"]').forEach(function (code) {
      if (code.getAttribute("data-wiki-code-highlighted") === "1" || code.closest(".wiki-editor__content")) {
        return;
      }
      const language = getCodeLanguage(code);
      if (language) {
        highlightCodeElement(code, language);
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

  let activeFootnotePopover = null;
  let footnoteCloseTimer = null;

  function getFootnoteRef(target) {
    return target && target.closest ? target.closest("[data-wiki-footnote-ref]") : null;
  }

  function isCoarsePointer() {
    return window.matchMedia && window.matchMedia("(hover: none), (pointer: coarse)").matches;
  }

  function clearFootnoteCloseTimer() {
    if (footnoteCloseTimer) {
      window.clearTimeout(footnoteCloseTimer);
      footnoteCloseTimer = null;
    }
  }

  function closeFootnotePopover() {
    clearFootnoteCloseTimer();
    if (activeFootnotePopover && activeFootnotePopover.popover) {
      activeFootnotePopover.popover.remove();
    }
    activeFootnotePopover = null;
  }

  function scheduleFootnotePopoverClose() {
    clearFootnoteCloseTimer();
    footnoteCloseTimer = window.setTimeout(closeFootnotePopover, 120);
  }

  function positionFootnotePopover(ref, popover) {
    const rect = ref.getBoundingClientRect();
    const margin = 12;

    popover.style.left = "0px";
    popover.style.top = "0px";
    popover.hidden = false;

    window.requestAnimationFrame(function () {
      const popoverRect = popover.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = document.documentElement.clientHeight || window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const top = spaceBelow > popoverRect.height + margin ?
        rect.bottom + 6 :
        Math.max(margin, rect.top - popoverRect.height - 6);
      const left = Math.min(
        Math.max(margin, rect.left + (rect.width / 2) - (popoverRect.width / 2)),
        Math.max(margin, viewportWidth - popoverRect.width - margin)
      );

      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    });
  }

  function openFootnotePopover(ref) {
    const templateId = ref && ref.getAttribute("data-wiki-footnote-template");
    const template = templateId ? document.getElementById(templateId) : null;

    if (!ref || !template || !template.innerHTML.trim()) {
      return false;
    }

    clearFootnoteCloseTimer();

    if (activeFootnotePopover && activeFootnotePopover.ref === ref) {
      positionFootnotePopover(ref, activeFootnotePopover.popover);
      return true;
    }

    closeFootnotePopover();

    const popover = document.createElement("div");
    popover.className = "wiki-footnote-popover";
    popover.setAttribute("role", "tooltip");
    popover.innerHTML = `<div class="wiki-footnote-popover__body">${template.innerHTML}</div>`;
    popover.hidden = true;
    document.body.appendChild(popover);

    activeFootnotePopover = {
      ref: ref,
      popover: popover
    };

    positionFootnotePopover(ref, popover);
    return true;
  }

  document.addEventListener("mouseover", function (event) {
    const ref = getFootnoteRef(event.target);
    if (ref) {
      openFootnotePopover(ref);
      return;
    }

    if (activeFootnotePopover && activeFootnotePopover.popover.contains(event.target)) {
      clearFootnoteCloseTimer();
    }
  }, true);

  document.addEventListener("mouseout", function (event) {
    if (!activeFootnotePopover) {
      return;
    }

    const ref = getFootnoteRef(event.target);
    const related = event.relatedTarget;

    if (
      (ref && (ref.contains(related) || activeFootnotePopover.popover.contains(related))) ||
      (activeFootnotePopover.popover.contains(event.target) &&
        (activeFootnotePopover.popover.contains(related) || activeFootnotePopover.ref.contains(related)))
    ) {
      return;
    }

    if (ref || activeFootnotePopover.popover.contains(event.target)) {
      scheduleFootnotePopoverClose();
    }
  }, true);

  document.addEventListener("focusin", function (event) {
    const ref = getFootnoteRef(event.target);
    if (ref) {
      openFootnotePopover(ref);
      return;
    }

    if (activeFootnotePopover && activeFootnotePopover.popover.contains(event.target)) {
      clearFootnoteCloseTimer();
    }
  }, true);

  document.addEventListener("focusout", function (event) {
    if (!activeFootnotePopover) {
      return;
    }

    const related = event.relatedTarget;
    if (
      activeFootnotePopover.ref.contains(related) ||
      activeFootnotePopover.popover.contains(related)
    ) {
      return;
    }

    scheduleFootnotePopoverClose();
  }, true);

  document.addEventListener("click", function (event) {
    const ref = getFootnoteRef(event.target);

    if (ref && isCoarsePointer() && (!activeFootnotePopover || activeFootnotePopover.ref !== ref)) {
      event.preventDefault();
      openFootnotePopover(ref);
      return;
    }

    if (
      activeFootnotePopover &&
      !ref &&
      !activeFootnotePopover.popover.contains(event.target)
    ) {
      closeFootnotePopover();
    }
  }, true);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeFootnotePopover();
    }
  });

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
        const slugLeaf = String(payload.data.slug || "").split("/").filter(Boolean).pop();
        const namespacePath = pendingWikiCreate && pendingWikiCreate.namespacePath;
        const cleanPath = namespacePath && slugLeaf ? `${namespacePath.replace(/\/$/, "")}/${slugLeaf}` : `wiki/${payload.data.slug}`;
        clearPendingWikiCreate();
        ajaxify.go(cleanPath.replace(/^\//, ""));
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
      maybeInitComposePage();
      highlightReadOnlyWikiCodeBlocks();
    });
    },
    function (err) {
      if (window.console && console.error) {
        console.error("westgate-wiki: could not load hooks", err);
      }
    }
  );

  $(document).on("click", "[data-wiki-scroll-top]", function (event) {
    event.preventDefault();
    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      window.scrollTo(0, 0);
    }
  });

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
  maybeInitComposePage();
  highlightReadOnlyWikiCodeBlocks();

  function getCsrfToken() {
    if (window.config && window.config.csrf_token) {
      return String(window.config.csrf_token);
    }
    return "";
  }

  function getRelativePath() {
    return (window.config && window.config.relative_path) || "";
  }

  function setPickerStatus(picker, message) {
    picker.find("[data-wiki-link-picker-status]").text(message || "");
  }

  function getComposerTextarea(composerEl) {
    return $(composerEl).find("textarea.write, textarea").first()[0] || null;
  }

  function insertIntoComposerTextarea(textarea, text) {
    if (!textarea || !text) {
      return;
    }

    require(
      ["composer/controls"],
      function (controls) {
        controls.insertIntoTextarea(textarea, text);
      },
      function () {
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || start;
        const value = textarea.value || "";
        textarea.value = value.slice(0, start) + text + value.slice(end);
        textarea.selectionStart = start + text.length;
        textarea.selectionEnd = start + text.length;
        $(textarea).trigger("input").focus();
      }
    );
  }

  function renderWikiLinkPickerResult(select, result) {
    const option = document.createElement("option");
    option.value = result.insertText || "";
    option.textContent = result.type === "namespace" ?
      `${result.title} namespace` :
      `${result.titleLeaf || result.title} · ${String(result.namespacePath || "").replace(/^\/wiki\/?/, "") || "wiki"}`;
    select.appendChild(option);
  }

  function ensureWikiLinkPicker(composerEl) {
    const composer = $(composerEl);
    let picker = composer.find("[data-wiki-link-picker]");

    if (picker.length) {
      return picker;
    }

    picker = $(
      "<div class=\"wiki-forum-link-picker border rounded-1 p-2 mt-1 hidden\" data-wiki-link-picker>" +
        "<div class=\"input-group input-group-sm mb-2\">" +
          "<input type=\"search\" class=\"form-control\" data-wiki-link-picker-query placeholder=\"Search wiki pages\" autocomplete=\"off\" />" +
          "<button type=\"button\" class=\"btn btn-outline-secondary\" data-wiki-link-picker-search>Search</button>" +
        "</div>" +
        "<select class=\"form-select form-select-sm mb-2\" size=\"5\" data-wiki-link-picker-results aria-label=\"Matching wiki links\"></select>" +
        "<div class=\"d-flex gap-2 align-items-center\">" +
          "<button type=\"button\" class=\"btn btn-primary btn-sm\" data-wiki-link-picker-insert>Insert link</button>" +
          "<button type=\"button\" class=\"btn btn-link btn-sm\" data-wiki-link-picker-close>Close</button>" +
          "<span class=\"small text-muted\" data-wiki-link-picker-status aria-live=\"polite\"></span>" +
        "</div>" +
      "</div>"
    );

    const formattingBar = composer.find(".formatting-bar").first();
    if (formattingBar.length) {
      formattingBar.after(picker);
    } else {
      composer.prepend(picker);
    }

    async function runSearch() {
      const query = (picker.find("[data-wiki-link-picker-query]").val() || "").trim();
      const select = picker.find("[data-wiki-link-picker-results]")[0];
      select.innerHTML = "";

      if (query.length < 2) {
        setPickerStatus(picker, "Type at least 2 characters.");
        return;
      }

      setPickerStatus(picker, "Searching...");

      try {
        const params = new URLSearchParams({
          q: query,
          context: "forum",
          scope: "all-wiki",
          limit: "25"
        });
        const res = await fetch(`${getRelativePath()}/api/v3/plugins/westgate-wiki/link-autocomplete?${params.toString()}`, {
          credentials: "same-origin"
        });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body && body.status && body.status.message ? body.status.message : res.statusText);
        }

        const results = (body.response && body.response.results) || [];
        results.forEach(function (result) {
          renderWikiLinkPickerResult(select, result);
        });
        setPickerStatus(picker, results.length ? "" : "No wiki matches.");
      } catch (err) {
        setPickerStatus(picker, (err && err.message) || String(err));
      }
    }

    picker.on("click", "[data-wiki-link-picker-search]", runSearch);
    picker.on("keydown", "[data-wiki-link-picker-query]", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        runSearch();
      } else if (event.key === "Escape") {
        picker.addClass("hidden");
      }
    });
    picker.on("click", "[data-wiki-link-picker-insert]", function () {
      const selected = picker.find("[data-wiki-link-picker-results] option:selected").first();
      const text = selected.val();
      if (!text) {
        setPickerStatus(picker, "Choose a wiki link first.");
        return;
      }
      insertIntoComposerTextarea(getComposerTextarea(composer), text);
      picker.addClass("hidden");
    });
    picker.on("dblclick", "[data-wiki-link-picker-results] option", function () {
      picker.find("[data-wiki-link-picker-insert]").trigger("click");
    });
    picker.on("click", "[data-wiki-link-picker-close]", function () {
      picker.addClass("hidden");
    });

    return picker;
  }

  function openWikiLinkPicker(composerEl) {
    const picker = ensureWikiLinkPicker(composerEl);
    picker.toggleClass("hidden");
    if (!picker.hasClass("hidden")) {
      picker.find("[data-wiki-link-picker-query]").trigger("focus");
    }
  }

  $(document).on("click", ".composer [data-format=\"wiki-link\"]", function (event) {
    const composerEl = event.currentTarget.closest("[component=\"composer\"], .composer");

    event.preventDefault();
    event.stopImmediatePropagation();

    if (composerEl) {
      openWikiLinkPicker(composerEl);
    }
  });

  function updateArticleWatchButton(btn, watched) {
    const icon = btn.querySelector("i");
    btn.setAttribute("data-watching", watched ? "1" : "0");
    btn.setAttribute("aria-pressed", watched ? "true" : "false");
    btn.setAttribute("title", watched ? "Stop watching wiki article edits" : "Watch wiki article edits");
    btn.setAttribute("aria-label", watched ? "Stop watching wiki article edits" : "Watch wiki article edits");
    btn.classList.toggle("active", watched);
    if (icon) {
      icon.classList.toggle("fa-eye", watched);
      icon.classList.toggle("fa-eye-slash", !watched);
    }
  }

  $(document).on("click", "[data-wiki-article-watch]", async function (event) {
    const btn = event.currentTarget;
    const tid = parseInt(btn.getAttribute("data-tid"), 10);
    const watching = btn.getAttribute("data-watching") === "1";

    if (!Number.isInteger(tid) || tid <= 0) {
      return;
    }

    event.preventDefault();

    const rel = getRelativePath();
    const base = rel.endsWith("/") ? rel.slice(0, -1) : rel;
    const url = `${base}/api/v3/plugins/westgate-wiki/article-watch?tid=${encodeURIComponent(tid)}`;
    const csrf = getCsrfToken();

    btn.disabled = true;

    try {
      const res = await fetch(url, {
        method: watching ? "DELETE" : "PUT",
        credentials: "same-origin",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrf
        },
        body: JSON.stringify({ tid: tid })
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body && body.status && body.status.message ? body.status.message : res.statusText);
      }

      const watched = !!(body.response && body.response.watched);
      updateArticleWatchButton(btn, watched);
      if (typeof app !== "undefined" && app.alert) {
        app.alert({
          type: "success",
          title: watched ? "Watching wiki article" : "Stopped watching wiki article",
          message: watched ?
            "You will be notified when this wiki article is edited." :
            "You will no longer receive wiki edit notifications for this article."
        });
      }
    } catch (err) {
      if (typeof app !== "undefined" && app.alert) {
        app.alert({
          type: "error",
          title: "Could not update article watch",
          message: (err && err.message) || String(err)
        });
      } else {
        window.alert((err && err.message) || String(err));
      }
    } finally {
      btn.disabled = false;
    }
  });

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

    const rel = getRelativePath();
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
