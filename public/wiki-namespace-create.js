"use strict";

/**
 * Child namespace create form: document-level submit delegation for ajaxify.
 */
(function () {
  function readConfig() {
    const el = document.getElementById("wiki-namespace-create-config");
    if (!el) {
      return null;
    }

    return {
      apiUrl: el.getAttribute("data-api-url") || "",
      csrfToken: el.getAttribute("data-csrf-token") || "",
      parentCid: parseInt(el.getAttribute("data-parent-cid"), 10)
    };
  }

  function getCsrfFallback() {
    if (window.config && window.config.csrf_token) {
      return String(window.config.csrf_token);
    }
    return "";
  }

  function setStatus(el, text) {
    if (el) {
      el.textContent = text || "";
    }
  }

  document.addEventListener("submit", async function (event) {
    const form = event.target && typeof event.target.closest === "function"
      ? event.target.closest("#wiki-namespace-create-form")
      : null;

    if (!form || form.id !== "wiki-namespace-create-form") {
      return;
    }

    event.preventDefault();

    const cfg = readConfig();
    if (!cfg || !cfg.apiUrl) {
      return;
    }

    if (!Number.isInteger(cfg.parentCid) || cfg.parentCid <= 0) {
      return;
    }

    const statusEl = document.getElementById("wiki-namespace-create-status");
    const submitBtn = document.getElementById("wiki-namespace-create-submit");
    const nameInput = document.getElementById("wiki-namespace-name");
    const descInput = document.getElementById("wiki-namespace-description");

    const name = (nameInput && nameInput.value) ? nameInput.value.trim() : "";
    const description = (descInput && descInput.value) ? descInput.value.trim() : "";

    if (!name) {
      setStatus(statusEl, "Enter a name.");
      return;
    }

    const body = {
      name: name,
      description: description,
      parentCid: cfg.parentCid
    };

    const csrf = cfg.csrfToken || getCsrfFallback();
    if (submitBtn) {
      submitBtn.disabled = true;
    }
    setStatus(statusEl, "Creating…");

    try {
      const res = await fetch(cfg.apiUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrf
        },
        body: JSON.stringify(body)
      });

      let payload = null;
      try {
        payload = await res.json();
      } catch (e) {
        payload = null;
      }

      if (!res.ok) {
        const msg = (payload && payload.status && payload.status.message) || res.statusText;
        throw new Error(msg);
      }

      const response = payload && payload.response;
      const wikiPath = response && response.wikiPath;

      if (wikiPath && typeof ajaxify !== "undefined" && ajaxify.go) {
        ajaxify.go(wikiPath.replace(/^\//, ""));
      } else if (wikiPath) {
        const rel = (window.config && window.config.relative_path) || "";
        const base = rel.endsWith("/") ? rel.slice(0, -1) : rel;
        window.location.href = `${base}${wikiPath}`;
      } else {
        throw new Error("Invalid response from server.");
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
      }
      setStatus(statusEl, (err && err.message) ? err.message : String(err));
      if (typeof app !== "undefined" && app.alert) {
        app.alert({
          type: "error",
          title: "Could not create namespace",
          message: (err && err.message) || String(err)
        });
      }
    }
  }, false);
})();
