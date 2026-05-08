"use strict";

define("admin/plugins/westgate-wiki", ["settings"], function (Settings) {
  const ACP = {};

  function getCheckedCategoryIds(settingsEl) {
    return settingsEl.find("[data-wiki-category-toggle]:checked").map(function () {
      return $(this).val();
    }).get();
  }

  function syncCheckboxesFromTextarea(settingsEl) {
    const selected = new Set(
      String(settingsEl.find("#categoryIds").val() || "")
        .split(/[\s,]+/)
        .filter(Boolean)
    );

    settingsEl.find("[data-wiki-category-toggle]").each(function () {
      $(this).prop("checked", selected.has($(this).val()));
    });
  }

  function syncTextareaFromCheckboxes(settingsEl) {
    const values = getCheckedCategoryIds(settingsEl);
    settingsEl.find("#categoryIds").val(values.join(", "));
    settingsEl.find("[data-selected-count]").text(values.length);
  }

  function getCheckedWikiNamespaceGroupNames(settingsEl) {
    return settingsEl.find("[data-wiki-namespace-creator-group]:checked").map(function () {
      return $(this).val();
    }).get();
  }

  function parseWikiNamespaceGroupNames(rawValue) {
    return String(rawValue || "")
      .split(/[\n,]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function syncWikiNamespaceGroupsFromTextarea(settingsEl) {
    const selected = new Set(
      parseWikiNamespaceGroupNames(settingsEl.find("#wikiNamespaceCreateGroups").val())
    );

    settingsEl.find("[data-wiki-namespace-creator-group]").each(function () {
      $(this).prop("checked", selected.has($(this).val()));
    });
  }

  function syncWikiNamespaceTextareaFromCheckboxes(settingsEl) {
    const checkedNames = getCheckedWikiNamespaceGroupNames(settingsEl);
    const knownNames = new Set(
      settingsEl.find("[data-wiki-namespace-creator-group]").map(function () {
        return $(this).val();
      }).get()
    );
    const manualNames = parseWikiNamespaceGroupNames(settingsEl.find("#wikiNamespaceCreateGroups").val())
      .filter(function (name) {
        return !knownNames.has(name);
      });
    const names = checkedNames.concat(manualNames);
    settingsEl.find("#wikiNamespaceCreateGroups").val(names.join(", "));
  }

  ACP.init = function () {
    const settingsEl = $(".westgate-wiki-settings");

    Settings.load("westgate-wiki", settingsEl, function () {
      syncCheckboxesFromTextarea(settingsEl);
      syncTextareaFromCheckboxes(settingsEl);
      syncWikiNamespaceGroupsFromTextarea(settingsEl);
      syncWikiNamespaceTextareaFromCheckboxes(settingsEl);
    });

    settingsEl.on("change", "[data-wiki-category-toggle]", function () {
      syncTextareaFromCheckboxes(settingsEl);
    });

    settingsEl.on("input", "#categoryIds", function () {
      syncCheckboxesFromTextarea(settingsEl);
      syncTextareaFromCheckboxes(settingsEl);
    });

    settingsEl.on("change", "[data-wiki-namespace-creator-group]", function () {
      syncWikiNamespaceTextareaFromCheckboxes(settingsEl);
    });

    settingsEl.on("input", "#wikiNamespaceCreateGroups", function () {
      syncWikiNamespaceGroupsFromTextarea(settingsEl);
    });

    $("#save").on("click", function () {
      syncTextareaFromCheckboxes(settingsEl);
      syncWikiNamespaceTextareaFromCheckboxes(settingsEl);
      Settings.save("westgate-wiki", settingsEl);
    });
  };

  return ACP;
});
