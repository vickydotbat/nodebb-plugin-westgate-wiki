import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export const slashCommandPluginKey = new PluginKey("wikiSlashCommand");

function defaultItems() {
  return [
    { id: "paragraph", label: "Paragraph", run: ({ editor }) => editor.chain().focus().setParagraph().run() },
    { id: "heading-1", label: "Heading 1", run: ({ editor }) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { id: "heading-2", label: "Heading 2", run: ({ editor }) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { id: "heading-3", label: "Heading 3", run: ({ editor }) => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { id: "bullet-list", label: "Bullet list", run: ({ editor }) => editor.chain().focus().toggleBulletList().run() },
    { id: "ordered-list", label: "Ordered list", run: ({ editor }) => editor.chain().focus().toggleOrderedList().run() },
    { id: "task-list", label: "Task list", run: ({ editor }) => editor.chain().focus().toggleTaskList().run() },
    { id: "quote", label: "Poetry quote", run: ({ editor }) => editor.chain().focus().insertWikiPoetryQuote().run() },
    { id: "code-block", label: "Code block", run: ({ editor }) => editor.chain().focus().toggleCodeBlock().run() },
    { id: "table", label: "Table", run: ({ editor }) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { id: "image", label: "Image", run: ({ editor }) => editor.storage.slashCommand.requestImageUpload(editor) },
    { id: "rule", label: "Horizontal rule", run: ({ editor }) => editor.chain().focus().setHorizontalRule().run() },
    { id: "callout-info", label: "Info callout", run: ({ editor }) => editor.chain().focus().insertWikiCallout({ type: "info", title: "Info" }).run() },
    { id: "callout-warning", label: "Warning callout", run: ({ editor }) => editor.chain().focus().insertWikiCallout({ type: "warning", title: "Warning" }).run() },
    { id: "callout-danger", label: "Danger callout", run: ({ editor }) => editor.chain().focus().insertWikiCallout({ type: "danger", title: "Danger" }).run() },
    { id: "wiki-link", label: "Wiki link", run: ({ editor }) => editor.commands.insertContent("[[Page]]") }
  ];
}

function isSlashTriggerAtSelection(state) {
  const { $from } = state.selection;
  if (!state.selection.empty || $from.parent.type.name !== "paragraph") {
    return false;
  }
  const textBefore = $from.parent.textBetween(0, $from.parentOffset, "\n", "\0");
  return /(?:^|\s)\/$/.test(textBefore);
}

function removeSlashTrigger(editor) {
  const { state } = editor;
  const { $from } = state.selection;
  if ($from.parentOffset <= 0) {
    return;
  }
  const from = $from.pos - 1;
  editor.commands.deleteRange({ from, to: $from.pos });
}

function updateMenuPosition(editor, menu) {
  const view = editor.view;
  let coords = { left: 0, bottom: 0 };
  try {
    coords = view.coordsAtPos(view.state.selection.from);
  } catch (err) {
    coords = { left: 0, bottom: 0 };
  }
  const rootRect = (editor.options.element || document.body).getBoundingClientRect();
  menu.style.left = `${Math.max(0, coords.left - rootRect.left)}px`;
  menu.style.top = `${Math.max(0, coords.bottom - rootRect.top + 6)}px`;
}

const SlashCommand = Extension.create({
  name: "slashCommand",
  addOptions() {
    return {
      getItems: defaultItems,
      requestImageUpload: function () {}
    };
  },
  addStorage() {
    return {
      isOpen: false,
      activeIndex: 0,
      requestImageUpload: this.options.requestImageUpload
    };
  },
  onCreate() {
    const editor = this.editor;
    const storage = editor.storage.slashCommand;
    editor.commands.openWikiSlashMenu = function () {
      storage.isOpen = true;
      storage.activeIndex = 0;
      return true;
    };
    editor.commands.closeWikiSlashMenu = function () {
      storage.isOpen = false;
      storage.activeIndex = 0;
      return true;
    };
  },
  addCommands() {
    const extension = this;
    return {
      openWikiSlashMenu:
        () =>
        () => {
          extension._forceOpen = true;
          extension.editor.storage.slashCommand.isOpen = true;
          extension.editor.storage.slashCommand.activeIndex = 0;
          return true;
        },
      closeWikiSlashMenu:
        () =>
        () => {
          extension._forceOpen = false;
          extension.editor.storage.slashCommand.isOpen = false;
          extension.editor.storage.slashCommand.activeIndex = 0;
          return true;
        }
    };
  },
  addProseMirrorPlugins() {
    const extension = this;
    let menu = null;

    function items() {
      return extension.options.getItems();
    }

    function render(editor) {
      if (!menu || !editor.storage.slashCommand.isOpen) {
        return;
      }

      const allItems = items();
      menu.innerHTML = "";
      allItems.forEach(function (item, index) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "wiki-tiptap-slash-menu__item";
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", index === editor.storage.slashCommand.activeIndex ? "true" : "false");
        button.textContent = item.label;
        button.addEventListener("mousedown", function (event) {
          event.preventDefault();
          editor.storage.slashCommand.activeIndex = index;
          removeSlashTrigger(editor);
          editor.commands.closeWikiSlashMenu();
          item.run({ editor });
        });
        menu.appendChild(button);
      });
      updateMenuPosition(editor, menu);
    }

    return [
      new Plugin({
        key: slashCommandPluginKey,
        view: (view) => {
          menu = document.createElement("div");
          menu.className = "wiki-tiptap-slash-menu";
          menu.setAttribute("role", "listbox");
          menu.hidden = true;
          view.dom.parentElement.appendChild(menu);

          return {
            update: () => {
              const editor = extension.editor;
              if (extension._forceOpen) {
                editor.storage.slashCommand.isOpen = true;
                editor.storage.slashCommand.activeIndex = 0;
                extension._forceOpen = false;
                menu.hidden = false;
                render(editor);
                return;
              }
              const shouldOpen = isSlashTriggerAtSelection(editor.state);
              if (shouldOpen) {
                editor.storage.slashCommand.isOpen = true;
              }
              if (!shouldOpen && editor.storage.slashCommand.isOpen) {
                const textBefore = editor.state.selection.$from.parent.textBetween(0, editor.state.selection.$from.parentOffset, "\n", "\0");
                if (!/(?:^|\s)\/\S*$/.test(textBefore)) {
                  editor.storage.slashCommand.isOpen = false;
                }
              }
              menu.hidden = !editor.storage.slashCommand.isOpen;
              render(editor);
            },
            destroy: () => {
              if (menu && menu.parentNode) {
                menu.parentNode.removeChild(menu);
              }
              menu = null;
            }
          };
        },
        props: {
          handleKeyDown: (view, event) => {
            const editor = extension.editor;
            if (!editor.storage.slashCommand.isOpen) {
              return false;
            }

            const allItems = items();
            if (event.key === "ArrowDown") {
              event.preventDefault();
              editor.storage.slashCommand.activeIndex = (editor.storage.slashCommand.activeIndex + 1) % allItems.length;
              render(editor);
              return true;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              editor.storage.slashCommand.activeIndex = (editor.storage.slashCommand.activeIndex + allItems.length - 1) % allItems.length;
              render(editor);
              return true;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              editor.commands.closeWikiSlashMenu();
              if (menu) {
                menu.hidden = true;
              }
              return true;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const item = allItems[editor.storage.slashCommand.activeIndex] || allItems[0];
              removeSlashTrigger(editor);
              editor.commands.closeWikiSlashMenu();
              if (menu) {
                menu.hidden = true;
              }
              item.run({ editor });
              return true;
            }
            return false;
          },
          handleDOMEvents: {
            blur: () => {
              extension.editor.commands.closeWikiSlashMenu();
              if (menu) {
                menu.hidden = true;
              }
              return false;
            },
            compositionstart: () => {
              extension.editor.commands.closeWikiSlashMenu();
              if (menu) {
                menu.hidden = true;
              }
              return false;
            }
          }
        }
      })
    ];
  }
});

export default SlashCommand;
