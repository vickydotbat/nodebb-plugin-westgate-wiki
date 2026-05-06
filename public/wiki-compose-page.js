/* global WestgateWikiEditor, WikiEditorBundle, ajaxify */
"use strict";

/** Must match `MAX_WIKI_MAIN_BODY_UTF8_BYTES` in lib/wiki-page-validation.js */
const MAX_WIKI_MAIN_BODY_UTF8_BYTES = 512 * 1024;
const PRIMARY_EDITOR_KIND = "tiptap";
const FALLBACK_EDITOR_KIND = "ckeditor";

function utf8ByteLength(str) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(str).length;
  }
  return unescape(encodeURIComponent(str)).length;
}

function decodePayloadB64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return JSON.parse(new TextDecoder("utf-8").decode(bytes));
}

function setStatus(el, text) {
  if (el) {
    el.textContent = text || "";
  }
}

function cleanupOrphanedCKEditorBodyWrappers() {
  document.querySelectorAll("body > .ck-body-wrapper").forEach(function (wrap) {
    if (wrap.querySelector(".ck-powered-by, .ck-powered-by-balloon")) {
      wrap.remove();
    }
  });
  document.querySelectorAll("body > .ck-powered-by-balloon, body > .ck.ck-powered-by-balloon").forEach(function (panel) {
    panel.remove();
  });
}

function waitForEditorGlobal(kind, attempts) {
  const max = attempts || 80;
  const globalName = kind === PRIMARY_EDITOR_KIND ? "WestgateWikiEditor" : "WikiEditorBundle";

  return new Promise(function (resolve, reject) {
    let n = 0;
    (function tick() {
      const candidate = window[globalName];
      if (candidate && typeof candidate.createWikiEditor === "function") {
        resolve(candidate);
        return;
      }
      n += 1;
      if (n >= max) {
        reject(new Error(`Editor bundle failed to load (${kind}).`));
        return;
      }
      setTimeout(tick, 50);
    })();
  });
}

function loadAssetOnce(tagName, attrs, markerAttr) {
  const existing = document.querySelector(`${tagName}[${markerAttr}]`);
  if (existing) {
    return Promise.resolve(existing);
  }

  return new Promise(function (resolve, reject) {
    const el = document.createElement(tagName);
    Object.entries(attrs).forEach(function ([key, value]) {
      el.setAttribute(key, value);
    });
    el.setAttribute(markerAttr, "1");
    el.addEventListener("load", function () {
      resolve(el);
    }, { once: true });
    el.addEventListener("error", function () {
      reject(new Error(`Failed to load ${attrs.href || attrs.src}`));
    }, { once: true });
    document.head.appendChild(el);
  });
}

async function ensureFallbackEditorAssets(payload) {
  const rel = payload.relativePath || "";
  const cacheSuffix = payload.cacheBuster ? `?${encodeURIComponent(payload.cacheBuster)}` : "";
  await loadAssetOnce("link", {
    rel: "stylesheet",
    href: `${rel}/westgate-wiki/compose/fallback-editor.css${cacheSuffix}`
  }, "data-westgate-wiki-fallback-editor-css");
  await loadAssetOnce("script", {
    defer: "defer",
    src: `${rel}/westgate-wiki/compose/fallback-editor.js${cacheSuffix}`
  }, "data-westgate-wiki-fallback-editor-js");
}

function normalizeCkEditorHandle(instance) {
  return {
    getHTML: function () {
      return instance.getData();
    },
    getJSON: function () {
      return null;
    },
    getMarkdown: function () {
      return typeof WikiEditorBundle.htmlToMarkdown === "function"
        ? WikiEditorBundle.htmlToMarkdown(instance.getData())
        : "";
    },
    setHTML: function (html) {
      instance.setData(html || "");
    },
    setMarkdown: function (markdown) {
      if (typeof WikiEditorBundle.markdownToHtml !== "function") {
        throw new Error("Markdown import is unavailable in the legacy editor bundle.");
      }
      instance.setData(WikiEditorBundle.markdownToHtml(markdown || ""));
    },
    insertWikiLink: function (insertText) {
      const snippet = String(insertText || "");
      instance.model.change(function (writer) {
        writer.insertText(snippet, instance.model.document.selection.getFirstPosition());
      });
    },
    focus: function () {
      if (instance.editing && instance.editing.view) {
        instance.editing.view.focus();
      }
    },
    destroy: function () {
      return instance.destroy();
    }
  };
}

async function createEditorHandle(kind, editorEl, payload, initialData) {
  if (kind === FALLBACK_EDITOR_KIND) {
    await ensureFallbackEditorAssets(payload);
  }

  const bundle = await waitForEditorGlobal(kind);
  const instance = await bundle.createWikiEditor(editorEl, {
    relativePath: payload.relativePath,
    csrfToken: payload.csrfToken,
    initialData: initialData
  });

  if (kind === FALLBACK_EDITOR_KIND) {
    return normalizeCkEditorHandle(instance);
  }

  return instance;
}

function getRequestedEditorKind() {
  const params = new URLSearchParams(window.location.search || "");
  const requested = String(params.get("editor") || "").toLowerCase();
  if (requested === FALLBACK_EDITOR_KIND) {
    return FALLBACK_EDITOR_KIND;
  }
  return PRIMARY_EDITOR_KIND;
}

async function initWikiComposePage() {
  const root = document.getElementById("westgate-wiki-compose");
  const dataEl = document.getElementById("westgate-wiki-compose-data");

  if (!root || !dataEl) {
    return;
  }

  if (root.getAttribute("data-wiki-compose-ready") === "1") {
    return;
  }
  root.setAttribute("data-wiki-compose-ready", "1");
  cleanupOrphanedCKEditorBodyWrappers();

  const b64 = dataEl.getAttribute("data-payload-b64");
  if (!b64) {
    return;
  }

  let payload;
  try {
    payload = decodePayloadB64(b64);
  } catch (err) {
    setStatus(document.getElementById("wiki-compose-status"), "Invalid page data.");
    return;
  }

  const titleInput = document.getElementById("wiki-compose-title");
  const editorEl = document.getElementById("wiki-compose-editor");
  const importTa = document.getElementById("wiki-compose-import-md");
  const importBtn = document.getElementById("wiki-compose-import-btn");
  const submitBtn = document.getElementById("wiki-compose-submit");
  const statusEl = document.getElementById("wiki-compose-status");
  const linkSearch = document.getElementById("wiki-compose-link-search");
  const linkSearchBtn = document.getElementById("wiki-compose-link-search-btn");
  const linkPick = document.getElementById("wiki-compose-link-pick");
  const linkInsert = document.getElementById("wiki-compose-link-insert");
  const cancelLink = document.getElementById("wiki-compose-cancel");
  const namespaceMainPageCheckbox = document.getElementById("wiki-compose-namespace-main-page");
  const discussionDisabledCheckbox = document.getElementById("wiki-compose-discussion-disabled");

  let editorInstance = null;
  let activeEditorKind = null;
  let destroyStarted = false;

  async function destroyWikiEditor() {
    if (destroyStarted || !editorInstance) {
      return;
    }

    const editor = editorInstance;
    editorInstance = null;
    destroyStarted = true;

    try {
      if (typeof editor.destroy === "function") {
        await editor.destroy();
      }
    } catch (err) {
      if (window.console && console.warn) {
        console.warn("westgate-wiki: editor cleanup failed", err);
      }
    } finally {
      destroyStarted = false;
      cleanupOrphanedCKEditorBodyWrappers();
    }
  }

  async function leaveComposePage(path) {
    await destroyWikiEditor();

    if (typeof ajaxify !== "undefined" && ajaxify.go) {
      ajaxify.go(path.replace(/^\//, ""));
    } else {
      window.location.href = `${payload.relativePath || ""}${path}`;
    }
  }

  function attachLifecycleCleanup() {
    window.westgateWikiDestroyComposeEditor = destroyWikiEditor;

    if (typeof require === "function" && !window.westgateWikiComposeAjaxCleanupAttached) {
      window.westgateWikiComposeAjaxCleanupAttached = true;
      require(["hooks"], function (hooks) {
        hooks.on("action:ajaxify.start", function () {
          if (window.westgateWikiDestroyComposeEditor) {
            window.westgateWikiDestroyComposeEditor();
          }
        });
      });
    }

    window.addEventListener("pagehide", function () {
      destroyWikiEditor();
    }, { once: true });

    if (cancelLink) {
      cancelLink.addEventListener("click", async function (event) {
        const href = cancelLink.getAttribute("href") || "";

        if (!href) {
          return;
        }

        event.preventDefault();
        await destroyWikiEditor();

        if (typeof ajaxify !== "undefined" && ajaxify.go) {
          const url = new URL(href, window.location.origin);
          const rel = (payload.relativePath || "").replace(/\/$/, "");
          const route = url.pathname.startsWith(rel) ? url.pathname.slice(rel.length) : url.pathname;
          ajaxify.go(route.replace(/^\//, ""));
        } else {
          window.location.href = href;
        }
      });
    }
  }

  async function initializeEditor() {
    const initialData = payload.mode === "edit" && typeof payload.initialContent === "string"
      ? payload.initialContent
      : "";
    const requestedKind = getRequestedEditorKind();
    const tiptapBundle = window.WestgateWikiEditor;
    const tiptapFallbackReason =
      requestedKind === PRIMARY_EDITOR_KIND &&
      tiptapBundle &&
      typeof tiptapBundle.detectUnsupportedContent === "function"
        ? tiptapBundle.detectUnsupportedContent(initialData)
        : "";

    if (requestedKind === FALLBACK_EDITOR_KIND) {
      activeEditorKind = FALLBACK_EDITOR_KIND;
      editorInstance = await createEditorHandle(FALLBACK_EDITOR_KIND, editorEl, payload, initialData);
      setStatus(statusEl, "Using legacy CKEditor fallback by request.");
      return;
    }

    if (tiptapFallbackReason) {
      activeEditorKind = FALLBACK_EDITOR_KIND;
      editorInstance = await createEditorHandle(FALLBACK_EDITOR_KIND, editorEl, payload, initialData);
      setStatus(statusEl, `Using legacy CKEditor fallback: ${tiptapFallbackReason}`);
      return;
    }

    try {
      activeEditorKind = PRIMARY_EDITOR_KIND;
      editorInstance = await createEditorHandle(PRIMARY_EDITOR_KIND, editorEl, payload, initialData);
      setStatus(statusEl, "");
    } catch (err) {
      activeEditorKind = FALLBACK_EDITOR_KIND;
      editorInstance = await createEditorHandle(FALLBACK_EDITOR_KIND, editorEl, payload, initialData);
      setStatus(statusEl, `Tiptap failed to initialize. Using legacy CKEditor fallback. ${(err && err.message) || String(err)}`);
    }
  }

  attachLifecycleCleanup();

  try {
    await initializeEditor();
  } catch (err) {
    setStatus(statusEl, (err && err.message) || String(err));
    return;
  }

  if (importBtn && importTa) {
    importBtn.addEventListener("click", function () {
      const md = (importTa.value || "").trim();
      if (!md) {
        return;
      }
      try {
        editorInstance.setMarkdown(md);
        importTa.value = "";
        setStatus(statusEl, activeEditorKind === FALLBACK_EDITOR_KIND ? "Markdown loaded into legacy editor." : "");
      } catch (err) {
        setStatus(statusEl, (err && err.message) || String(err));
      }
    });
  }

  async function runLinkSearch() {
    const q = (linkSearch && linkSearch.value) || "";
    linkPick.innerHTML = "";
    try {
      const params = new URLSearchParams({
        q: q,
        context: "wiki",
        cid: String(payload.cid),
        scope: "current-namespace",
        limit: "25"
      });
      const url = payload.linkAutocompleteUrl ?
        `${payload.linkAutocompleteUrl}?${params.toString()}` :
        `${payload.namespaceSearchUrl}?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { credentials: "same-origin" });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body && body.status && body.status.message ? body.status.message : res.statusText);
      }
      const topics = payload.linkAutocompleteUrl ?
        ((body.response && body.response.results) || []).filter(function (r) { return r.type === "page"; }) :
        ((body.response && body.response.topics) || []);
      topics.forEach(function (t) {
        const opt = document.createElement("option");
        opt.value = t.insertText || `[[${t.titleLeaf || t.title}]]`;
        opt.textContent = t.titleLeaf || t.title;
        linkPick.appendChild(opt);
      });
    } catch (err) {
      setStatus(statusEl, (err && err.message) || String(err));
    }
  }

  if (linkSearchBtn) {
    linkSearchBtn.addEventListener("click", runLinkSearch);
  }

  if (linkInsert) {
    linkInsert.addEventListener("click", function () {
      const opt = linkPick.selectedOptions && linkPick.selectedOptions[0];
      const label = opt ? opt.value.trim() : "";
      if (!label) {
        return;
      }
      editorInstance.insertWikiLink(label);
      editorInstance.focus();
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", async function () {
      const title = (titleInput && titleInput.value.trim()) || "";
      if (!title) {
        setStatus(statusEl, "Title is required.");
        return;
      }

      const content = (editorInstance.getHTML() || "").trim();
      if (!content) {
        setStatus(statusEl, "Body cannot be empty.");
        return;
      }

      const bodyBytes = utf8ByteLength(content);
      if (bodyBytes > MAX_WIKI_MAIN_BODY_UTF8_BYTES) {
        setStatus(
          statusEl,
          "Article body is too large (max " +
            Math.round(MAX_WIKI_MAIN_BODY_UTF8_BYTES / 1024) +
            " KiB UTF-8). Shorten the content before submitting."
        );
        return;
      }

      submitBtn.disabled = true;
      const isEdit = payload.mode === "edit" && payload.postEditUrl;
      setStatus(statusEl, isEdit ? "Saving…" : "Publishing…");

      try {
        let res;
        let body;

        if (payload.pageTitleCheckUrl) {
          const params = new URLSearchParams({
            cid: String(payload.cid),
            title: title
          });
          if (payload.mode === "edit" && payload.tid) {
            params.set("tid", String(payload.tid));
          }
          const checkRes = await fetch(`${payload.pageTitleCheckUrl}?${params.toString()}`, {
            credentials: "same-origin"
          });
          const checkBody = await checkRes.json();
          if (!checkRes.ok) {
            const msg = (checkBody && checkBody.status && checkBody.status.message) || checkRes.statusText;
            throw new Error(msg);
          }
          if (checkBody && checkBody.response && checkBody.response.ok === false) {
            throw new Error(checkBody.response.message || "This title cannot be published at a clean wiki URL.");
          }
        }

        if (isEdit) {
          res = await fetch(payload.postEditUrl, {
            method: "PUT",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": payload.csrfToken
            },
            body: JSON.stringify({
              content: content,
              title: title
            })
          });
          body = await res.json();
        } else {
          res = await fetch(payload.topicsApiUrl, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": payload.csrfToken
            },
            body: JSON.stringify({
              cid: payload.cid,
              title: title,
              content: content,
              tags: []
            })
          });
          body = await res.json();
        }

        if (!res.ok) {
          const msg = (body && body.status && body.status.message) || res.statusText;
          throw new Error(msg);
        }

        const responsePayload = body.response;
        let wikiSlug = null;
        const savedTid = (
          responsePayload &&
          (responsePayload.tid || (responsePayload.topic && responsePayload.topic.tid))
        ) || payload.tid;

        if (isEdit && responsePayload && responsePayload.topic && responsePayload.topic.slug) {
          wikiSlug = responsePayload.topic.slug;
        } else if (!isEdit && responsePayload && responsePayload.slug) {
          wikiSlug = responsePayload.slug;
        }

        if (
          payload.canSetNamespaceMainPage &&
          payload.namespaceMainPageApiUrl &&
          namespaceMainPageCheckbox &&
          savedTid
        ) {
          const mainRes = await fetch(payload.namespaceMainPageApiUrl, {
            method: "PUT",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": payload.csrfToken
            },
            body: JSON.stringify({
              tid: parseInt(savedTid, 10),
              active: namespaceMainPageCheckbox.checked
            })
          });
          if (!mainRes.ok) {
            let mainJson = null;
            try {
              mainJson = await mainRes.json();
            } catch (e) {
              mainJson = null;
            }
            const mainMsg = (mainJson && mainJson.status && mainJson.status.message) || mainRes.statusText;
            throw new Error("Page saved, but the namespace main page was not updated: " + mainMsg);
          }
        }

        if (
          isEdit &&
          payload.discussionSettingsApiUrl &&
          discussionDisabledCheckbox &&
          savedTid
        ) {
          const discussionRes = await fetch(payload.discussionSettingsApiUrl, {
            method: "PUT",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "x-csrf-token": payload.csrfToken
            },
            body: JSON.stringify({
              tid: parseInt(savedTid, 10),
              disabled: discussionDisabledCheckbox.checked
            })
          });
          if (!discussionRes.ok) {
            let discussionJson = null;
            try {
              discussionJson = await discussionRes.json();
            } catch (e) {
              discussionJson = null;
            }
            const discussionMsg = (discussionJson && discussionJson.status && discussionJson.status.message) || discussionRes.statusText;
            throw new Error("Page saved, but the discussion setting was not updated: " + discussionMsg);
          }
        }

        let homepageSetOk = false;
        if (!isEdit && payload.setAsWikiHome && payload.wikiHomepageApiUrl) {
          const tidVal = savedTid;
          if (tidVal) {
            const putRes = await fetch(payload.wikiHomepageApiUrl, {
              method: "PUT",
              credentials: "same-origin",
              headers: {
                "Content-Type": "application/json",
                "x-csrf-token": payload.csrfToken
              },
              body: JSON.stringify({ tid: parseInt(tidVal, 10) })
            });
            if (putRes.ok) {
              homepageSetOk = true;
            } else {
              let putJson = null;
              try {
                putJson = await putRes.json();
              } catch (e) {
                putJson = null;
              }
              const putMsg = (putJson && putJson.status && putJson.status.message) || putRes.statusText;
              setStatus(
                statusEl,
                "Page published, but /wiki was not set as the homepage: " + putMsg + " You can set the topic id in the ACP."
              );
            }
          }
        }

        if (homepageSetOk) {
          await leaveComposePage("/wiki");
          return;
        }

        const slugLeaf = wikiSlug ? String(wikiSlug).split("/").filter(Boolean).pop() : "";
        const cleanWikiPath = payload.sectionWikiPath && slugLeaf ? `${payload.sectionWikiPath}/${slugLeaf}` : "";

        if (cleanWikiPath) {
          await leaveComposePage(cleanWikiPath);
        } else {
          throw new Error("Unexpected API response");
        }
      } catch (err) {
        setStatus(statusEl, (err && err.message) || String(err));
        submitBtn.disabled = false;
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    initWikiComposePage();
  });
} else {
  initWikiComposePage();
}

window.westgateWikiInitComposePage = initWikiComposePage;
