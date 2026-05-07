import { JSDOM } from "jsdom";

export function installJsdomGlobals() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
    url: "https://example.test/wiki"
  });

  const { window } = dom;
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: window },
    document: { configurable: true, value: window.document },
    DOMParser: { configurable: true, value: window.DOMParser },
    navigator: { configurable: true, value: window.navigator },
    Node: { configurable: true, value: window.Node },
    Text: { configurable: true, value: window.Text },
    HTMLElement: { configurable: true, value: window.HTMLElement },
    HTMLAnchorElement: { configurable: true, value: window.HTMLAnchorElement },
    HTMLImageElement: { configurable: true, value: window.HTMLImageElement },
    HTMLDivElement: { configurable: true, value: window.HTMLDivElement },
    HTMLParagraphElement: { configurable: true, value: window.HTMLParagraphElement },
    Event: { configurable: true, value: window.Event },
    CustomEvent: { configurable: true, value: window.CustomEvent },
    MutationObserver: { configurable: true, value: window.MutationObserver },
    getSelection: { configurable: true, value: window.getSelection.bind(window) },
    requestAnimationFrame: { configurable: true, value: window.requestAnimationFrame.bind(window) },
    cancelAnimationFrame: { configurable: true, value: window.cancelAnimationFrame.bind(window) }
  });

  return dom;
}
