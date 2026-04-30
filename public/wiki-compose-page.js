/* global WikiEditorBundle, ajaxify */
"use strict";

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

function waitForBundle(callback, attempts) {
  const max = attempts || 80;
  let n = 0;
  (function tick() {
    if (typeof WikiEditorBundle !== "undefined" && WikiEditorBundle.createWikiEditor) {
      callback();
      return;
    }
    n += 1;
    if (n >= max) {
      setStatus(document.getElementById("wiki-compose-status"), "Editor failed to load. Rebuild plugin assets (npm run build:ckeditor) and clear cache.");
      return;
    }
    setTimeout(tick, 50);
  })();
}

function initWikiComposePage() {
  const root = document.getElementById("westgate-wiki-compose");
  const dataEl = document.getElementById("westgate-wiki-compose-data");

  if (!root || !dataEl) {
    return;
  }

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

  let editorInstance = null;

  waitForBundle(async function () {
    try {
      const initialData = payload.mode === "edit" && typeof payload.initialContent === "string"
        ? payload.initialContent
        : "";

      editorInstance = await WikiEditorBundle.createWikiEditor(editorEl, {
        relativePath: payload.relativePath,
        csrfToken: payload.csrfToken,
        initialData: initialData
      });
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
          const html = WikiEditorBundle.markdownToHtml(md);
          editorInstance.setData(html);
          importTa.value = "";
        } catch (err2) {
          setStatus(statusEl, (err2 && err2.message) || String(err2));
        }
      });
    }

    async function runLinkSearch() {
      const q = (linkSearch && linkSearch.value) || "";
      linkPick.innerHTML = "";
      try {
        const url = `${payload.namespaceSearchUrl}?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { credentials: "same-origin" });
        const body = await res.json();
        if (!res.ok) {
          throw new Error(body && body.status && body.status.message ? body.status.message : res.statusText);
        }
        const topics = (body.response && body.response.topics) || [];
        topics.forEach(function (t) {
          const opt = document.createElement("option");
          opt.value = t.titleLeaf || t.title;
          opt.textContent = t.titleLeaf || t.title;
          linkPick.appendChild(opt);
        });
      } catch (err3) {
        setStatus(statusEl, (err3 && err3.message) || String(err3));
      }
    }

    if (linkSearchBtn) {
      linkSearchBtn.addEventListener("click", runLinkSearch);
    }

    if (linkInsert && editorInstance) {
      linkInsert.addEventListener("click", function () {
        const opt = linkPick.selectedOptions && linkPick.selectedOptions[0];
        const label = opt ? opt.value.trim() : "";
        if (!label) {
          return;
        }
        const snippet = `[[${label}]]`;
        editorInstance.model.change(function (writer) {
          writer.insertText(snippet, editorInstance.model.document.selection.getFirstPosition());
        });
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", async function () {
        const title = (titleInput && titleInput.value.trim()) || "";
        if (!title) {
          setStatus(statusEl, "Title is required.");
          return;
        }
        const content = (editorInstance.getData() || "").trim();
        if (!content) {
          setStatus(statusEl, "Body cannot be empty.");
          return;
        }

        submitBtn.disabled = true;
        const isEdit = payload.mode === "edit" && payload.postEditUrl;
        setStatus(statusEl, isEdit ? "Saving…" : "Publishing…");

        try {
          let res;
          let body;

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

          if (isEdit && responsePayload && responsePayload.topic && responsePayload.topic.slug) {
            wikiSlug = responsePayload.topic.slug;
          } else if (!isEdit && responsePayload && responsePayload.slug) {
            wikiSlug = responsePayload.slug;
          }

          let homepageSetOk = false;
          if (!isEdit && payload.setAsWikiHome && payload.wikiHomepageApiUrl) {
            const tidVal = responsePayload && (responsePayload.tid || (responsePayload.topic && responsePayload.topic.tid));
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
            if (typeof ajaxify !== "undefined" && ajaxify.go) {
              ajaxify.go("wiki");
            } else {
              window.location.href = (payload.relativePath || "") + "/wiki";
            }
            return;
          }

          const slugLeaf = wikiSlug ? String(wikiSlug).split("/").filter(Boolean).pop() : "";
          const cleanWikiPath = payload.sectionWikiPath && slugLeaf ? `${payload.sectionWikiPath}/${slugLeaf}` : "";

          if (cleanWikiPath && typeof ajaxify !== "undefined" && ajaxify.go) {
            ajaxify.go(cleanWikiPath.replace(/^\//, ""));
          } else if (cleanWikiPath) {
            window.location.href = `${payload.relativePath || ""}${cleanWikiPath}`;
          } else {
            throw new Error("Unexpected API response");
          }
        } catch (err5) {
          setStatus(statusEl, (err5 && err5.message) || String(err5));
          submitBtn.disabled = false;
        }
      });
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWikiComposePage);
} else {
  initWikiComposePage();
}
