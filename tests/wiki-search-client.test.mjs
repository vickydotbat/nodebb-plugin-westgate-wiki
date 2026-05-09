import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { installJsdomGlobals } from "./helpers/jsdom-setup.mjs";

const dom = installJsdomGlobals();
const scriptPath = path.join(process.cwd(), "public/wiki-search.js");
const script = fs.readFileSync(scriptPath, "utf8");

globalThis.window.config = { relative_path: "" };
globalThis.window.eval(script);

function tick(ms = 0) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resetDom(html) {
  document.body.innerHTML = html;
  window.westgateWikiSearch.scan(document);
}

await (async function testHeaderSuggestionsDebounceAndEscape() {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return {
      ok: true,
      json: async () => ({
        response: {
          query: "map",
          results: [
            { type: "page", titleLeaf: "Map Creation Guide", namespaceTitle: "Development", wikiPath: "/wiki/development/map-creation-guide" }
          ],
          totalReturned: 1,
          queryTooShort: false
        }
      })
    };
  };
  window.fetch = globalThis.fetch;

  resetDom(`
    <form action="/wiki/search" data-wiki-search-form>
      <input data-wiki-search-input data-wiki-search-mode="suggest" name="q" />
      <div data-wiki-search-suggestions hidden>
        <div data-wiki-search-status></div>
        <ul data-wiki-search-results></ul>
        <a data-wiki-search-all hidden></a>
      </div>
    </form>
  `);

  const input = document.querySelector("[data-wiki-search-input]");
  input.value = "map";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await tick(280);

  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/api\/v3\/plugins\/westgate-wiki\/search/);
  assert.match(calls[0], /q=map/);
  assert.match(calls[0], /mode=suggest/);
  assert.match(document.querySelector("[data-wiki-search-results]").textContent, /Map Creation Guide/);
  assert.equal(document.querySelector("[data-wiki-search-suggestions]").hidden, false);

  input.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(document.querySelector("[data-wiki-search-suggestions]").hidden, true);
})();

await (async function testStaleSuggestionResponsesAreIgnored() {
  const resolvers = [];
  window.fetch = globalThis.fetch = (url) => new Promise((resolve) => {
    resolvers.push({ url: String(url), resolve });
  });

  resetDom(`
    <form action="/wiki/search" data-wiki-search-form>
      <input data-wiki-search-input data-wiki-search-mode="suggest" name="q" />
      <div data-wiki-search-suggestions hidden>
        <div data-wiki-search-status></div>
        <ul data-wiki-search-results></ul>
        <a data-wiki-search-all hidden></a>
      </div>
    </form>
  `);

  const input = document.querySelector("[data-wiki-search-input]");
  input.value = "map";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await tick(280);
  input.value = "mage";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await tick(280);

  assert.equal(resolvers.length, 2);
  resolvers[1].resolve({
    ok: true,
    json: async () => ({ response: { results: [{ type: "page", titleLeaf: "Mage", namespaceTitle: "Lore", wikiPath: "/wiki/lore/mage" }], totalReturned: 1 } })
  });
  await tick();
  resolvers[0].resolve({
    ok: true,
    json: async () => ({ response: { results: [{ type: "page", titleLeaf: "Map", namespaceTitle: "Development", wikiPath: "/wiki/development/map" }], totalReturned: 1 } })
  });
  await tick();

  const text = document.querySelector("[data-wiki-search-results]").textContent;
  assert.match(text, /Mage/);
  assert.doesNotMatch(text, /Map/);
})();

await (async function testSearchPageInstantResults() {
  window.fetch = globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      response: {
        query: "map",
        groups: {
          exact: [],
          pages: [
            { type: "page", titleLeaf: "Map Creation Guide", namespaceTitle: "Development", wikiPath: "/wiki/development/map-creation-guide" }
          ],
          namespaces: [
            { type: "namespace", title: "Maps", wikiPath: "/wiki/maps" }
          ]
        },
        totalReturned: 2,
        queryTooShort: false
      }
    })
  });

  resetDom(`
    <form action="/wiki/search" data-wiki-search-form>
      <input data-wiki-search-input data-wiki-search-mode="suggest" name="q" />
      <div data-wiki-search-suggestions hidden>
        <div data-wiki-search-status></div>
        <ul data-wiki-search-results></ul>
        <a data-wiki-search-all hidden></a>
      </div>
    </form>
    <section data-wiki-search-page>
      <h1 data-wiki-search-heading>Search the Wiki</h1>
      <div data-wiki-search-page-status></div>
      <div data-wiki-search-page-results></div>
    </section>
  `);

  const input = document.querySelector("[data-wiki-search-input]");
  input.value = "map";
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  await tick(280);

  const pageText = document.querySelector("[data-wiki-search-page-results]").textContent;
  assert.equal(document.querySelector("[data-wiki-search-heading]").textContent, "Results for map");
  assert.match(pageText, /Pages/);
  assert.match(pageText, /Map Creation Guide/);
  assert.match(pageText, /Namespaces/);
  assert.match(pageText, /Maps/);
})();

console.log("wiki-search client tests passed");
