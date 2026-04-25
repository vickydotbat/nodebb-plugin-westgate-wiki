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

  ACP.init = function () {
    const settingsEl = $(".westgate-wiki-settings");

    Settings.load("westgate-wiki", settingsEl, function () {
      syncCheckboxesFromTextarea(settingsEl);
      syncTextareaFromCheckboxes(settingsEl);
    });

    settingsEl.on("change", "[data-wiki-category-toggle]", function () {
      syncTextareaFromCheckboxes(settingsEl);
    });

    settingsEl.on("input", "#categoryIds", function () {
      syncCheckboxesFromTextarea(settingsEl);
      syncTextareaFromCheckboxes(settingsEl);
    });

    $("#save").on("click", function () {
      syncTextareaFromCheckboxes(settingsEl);
      Settings.save("westgate-wiki", settingsEl);
    });
  };

  return ACP;
});
