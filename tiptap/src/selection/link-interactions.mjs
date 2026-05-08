export function getEditorLinkFromEvent(event, editorMount) {
  const target = event && event.target;
  const targetElement = target && target.nodeType === 3 ? target.parentElement : target;
  const link = targetElement && typeof targetElement.closest === "function" ?
    targetElement.closest("a[href], [data-wiki-link-href]") :
    null;

  if (!link || !editorMount || !editorMount.contains(link)) {
    return null;
  }

  return link;
}

function cancelLinkEvent(event) {
  event.preventDefault();
  event.stopPropagation();
  if (typeof event.stopImmediatePropagation === "function") {
    event.stopImmediatePropagation();
  }
}

export function selectEditorLink(editor, link) {
  if (!editor || !link || !editor.view || typeof editor.view.posAtDOM !== "function") {
    return false;
  }

  const posTarget = link.firstChild || link;
  let pos = null;
  try {
    pos = editor.view.posAtDOM(posTarget, 0);
  } catch (err) {
    return false;
  }

  editor.chain().focus().setTextSelection(pos).extendMarkRange("link").run();
  return true;
}

export function handleEditorLinkClick({ editor, editorMount, getLinkContextToolbar }, event) {
  const link = getEditorLinkFromEvent(event, editorMount);
  if (!link) {
    return false;
  }

  cancelLinkEvent(event);
  selectEditorLink(editor, link);

  const toolbar = typeof getLinkContextToolbar === "function" ? getLinkContextToolbar() : null;
  if (toolbar && typeof toolbar.showForLink === "function") {
    toolbar.showForLink(link);
  }

  return true;
}

export function installEditorLinkNavigationGuard({ editorMount, editor, getLinkContextToolbar }) {
  if (!editorMount || typeof editorMount.addEventListener !== "function") {
    return function () {};
  }
  const ownerWindow = editorMount.ownerDocument && editorMount.ownerDocument.defaultView;
  const captureTargets = ownerWindow && typeof ownerWindow.addEventListener === "function"
    ? [ownerWindow, editorMount]
    : [editorMount];

  function handleGuardedClick(event) {
    handleEditorLinkClick({
      editor,
      editorMount,
      getLinkContextToolbar
    }, event);
  }

  captureTargets.forEach(function (target) {
    target.addEventListener("mousedown", handleGuardedClick, true);
    target.addEventListener("click", handleGuardedClick, true);
    target.addEventListener("auxclick", handleGuardedClick, true);
  });

  return function destroyEditorLinkNavigationGuard() {
    captureTargets.forEach(function (target) {
      target.removeEventListener("mousedown", handleGuardedClick, true);
      target.removeEventListener("click", handleGuardedClick, true);
      target.removeEventListener("auxclick", handleGuardedClick, true);
    });
  };
}
