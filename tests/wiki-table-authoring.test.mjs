import assert from "node:assert/strict";

import { installJsdomGlobals } from "./helpers/jsdom-setup.mjs";

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === "function") {
      return result.then(function () {
        process.stdout.write(`ok - ${name}\n`);
      });
    }
    process.stdout.write(`ok - ${name}\n`);
  } catch (err) {
    process.stderr.write(`not ok - ${name}\n`);
    throw err;
  }
  return Promise.resolve();
}

installJsdomGlobals();

const [
  tableDomModule,
  tableViewModule
] = await Promise.all([
  import("../tiptap/src/table/table-dom.mjs"),
  import("../tiptap/src/table/table-view.mjs")
]);

const {
  getSelectionElement,
  setClassToken,
  setStyleValue,
  getStyleValue,
  positionContextPanel
} = tableDomModule;
const { WestgateTableView, applyTableNodeAttributesToView } = tableViewModule;

await test("table DOM helpers preserve class tokens and style values", function () {
  assert.equal(setClassToken("one two", "three", true), "one two three");
  assert.equal(setClassToken("one two", "two", false), "one");
  assert.equal(setStyleValue("width: 50%; color: red", "width", "75%"), "width: 75%; color: red");
  assert.equal(setStyleValue("width: 50%; color: red", "color", ""), "width: 50%");
  assert.equal(getStyleValue("width: 50%; color: red", "width"), "50%");
  assert.equal(getStyleValue("width: 50%; color: red", "height"), "");
});

await test("positionContextPanel clamps panel within the editor surface", function () {
  const surface = document.createElement("div");
  const target = document.createElement("div");
  const panel = document.createElement("div");
  Object.defineProperty(surface, "offsetWidth", { value: 600 });
  Object.defineProperty(panel, "offsetWidth", { value: 180 });
  Object.defineProperty(panel, "offsetHeight", { value: 32 });
  surface.getBoundingClientRect = function () {
    return { left: 10, top: 20, width: 600, height: 300, right: 610, bottom: 320 };
  };
  target.getBoundingClientRect = function () {
    return { left: 580, top: 90, width: 80, height: 32, right: 660, bottom: 122 };
  };

  positionContextPanel(panel, target, surface, { avoidTop: 48 });

  assert.equal(panel.style.left, "412px");
  assert.equal(panel.style.top, "40px");
});

await test("table view exports preserve table class and style attributes", function () {
  const table = document.createElement("table");
  applyTableNodeAttributesToView(table, {
    class: "wiki-table-layout-auto",
    style: "width: 50%;"
  });
  assert.equal(table.getAttribute("class"), "wiki-table-layout-auto");
  assert.equal(table.getAttribute("style"), "width: 50%;");
  assert.equal(typeof WestgateTableView, "function");
});

await test("getSelectionElement tolerates missing editor selection DOM", function () {
  assert.equal(getSelectionElement({ view: { domAtPos: function () { return {}; } }, state: { selection: { from: 1 } } }), null);
});
