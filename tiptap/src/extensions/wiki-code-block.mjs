import { mergeAttributes } from "@tiptap/core";
import CodeBlock from "@tiptap/extension-code-block";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const CODE_BLOCK_LANGUAGE_OPTIONS = [
  { value: "", label: "Plain text" },
  { value: "bash", label: "Bash" },
  { value: "powershell", label: "PowerShell" },
  { value: "csharp", label: "C#" }
];

const CODE_BLOCK_LANGUAGE_ALIASES = new Map([
  ["bash", "bash"],
  ["sh", "bash"],
  ["shell", "bash"],
  ["powershell", "powershell"],
  ["pwsh", "powershell"],
  ["ps1", "powershell"],
  ["csharp", "csharp"],
  ["cs", "csharp"],
  ["c#", "csharp"]
]);

const TOKEN_KEYWORDS = {
  bash: new Set([
    "case", "do", "done", "elif", "else", "esac", "fi", "for", "function",
    "if", "in", "local", "return", "select", "then", "until", "while"
  ]),
  powershell: new Set([
    "begin", "break", "catch", "class", "continue", "data", "do", "dynamicparam",
    "else", "elseif", "end", "exit", "filter", "finally", "for", "foreach",
    "from", "function", "if", "in", "param", "process", "return", "switch",
    "throw", "trap", "try", "until", "using", "while"
  ]),
  csharp: new Set([
    "abstract", "as", "base", "bool", "break", "byte", "case", "catch",
    "char", "checked", "class", "const", "continue", "decimal", "default",
    "delegate", "do", "double", "else", "enum", "event", "explicit", "extern",
    "false", "finally", "fixed", "float", "for", "foreach", "goto", "if",
    "implicit", "in", "int", "interface", "internal", "is", "lock", "long",
    "namespace", "new", "null", "object", "operator", "out", "override",
    "params", "private", "protected", "public", "readonly", "ref", "return",
    "sbyte", "sealed", "short", "sizeof", "stackalloc", "static", "string",
    "struct", "switch", "this", "throw", "true", "try", "typeof", "uint",
    "ulong", "unchecked", "unsafe", "ushort", "using", "virtual", "void",
    "volatile", "while"
  ])
};

export function normalizeCodeBlockLanguage(value) {
  const key = String(value || "").trim().toLowerCase();
  return CODE_BLOCK_LANGUAGE_ALIASES.get(key) || null;
}

function pushToken(tokens, from, to, type) {
  if (to > from) {
    tokens.push({ from, to, type });
  }
}

function readQuoted(text, start) {
  const quote = text[start];
  let index = start + 1;
  while (index < text.length) {
    if (text[index] === "\\") {
      index += 2;
      continue;
    }
    if (text[index] === quote) {
      return index + 1;
    }
    index += 1;
  }
  return text.length;
}

function tokenizeCodeBlock(text, language) {
  const normalizedLanguage = normalizeCodeBlockLanguage(language);
  const keywords = TOKEN_KEYWORDS[normalizedLanguage];
  if (!keywords) {
    return [];
  }

  const tokens = [];
  const wordPattern = normalizedLanguage === "powershell" ? /-?[A-Za-z_][\w-]*/y : /[A-Za-z_]\w*/y;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (char === "\"" || char === "'") {
      const end = readQuoted(text, index);
      pushToken(tokens, index, end, "string");
      index = end;
      continue;
    }

    if (normalizedLanguage === "csharp" && char === "/" && next === "/") {
      const end = text.indexOf("\n", index);
      const commentEnd = end === -1 ? text.length : end;
      pushToken(tokens, index, commentEnd, "comment");
      index = commentEnd;
      continue;
    }

    if (normalizedLanguage === "csharp" && char === "/" && next === "*") {
      const end = text.indexOf("*/", index + 2);
      const commentEnd = end === -1 ? text.length : end + 2;
      pushToken(tokens, index, commentEnd, "comment");
      index = commentEnd;
      continue;
    }

    if ((normalizedLanguage === "bash" || normalizedLanguage === "powershell") && char === "#") {
      const end = text.indexOf("\n", index);
      const commentEnd = end === -1 ? text.length : end;
      pushToken(tokens, index, commentEnd, "comment");
      index = commentEnd;
      continue;
    }

    if ((normalizedLanguage === "bash" || normalizedLanguage === "powershell") && char === "$") {
      const match = /^\$[{]?[A-Za-z_][\w:.-]*[}]?/.exec(text.slice(index));
      if (match) {
        pushToken(tokens, index, index + match[0].length, "variable");
        index += match[0].length;
        continue;
      }
    }

    if (/\d/.test(char)) {
      const match = /^\d+(?:\.\d+)?/.exec(text.slice(index));
      if (match) {
        pushToken(tokens, index, index + match[0].length, "number");
        index += match[0].length;
        continue;
      }
    }

    wordPattern.lastIndex = index;
    const wordMatch = wordPattern.exec(text);
    if (wordMatch) {
      const word = wordMatch[0].replace(/^-/, "").toLowerCase();
      if (keywords.has(word)) {
        pushToken(tokens, index, index + wordMatch[0].length, "keyword");
      }
      index += wordMatch[0].length;
      continue;
    }

    index += 1;
  }

  return tokens;
}

function buildSyntaxDecorations(doc) {
  const decorations = [];
  doc.descendants(function (node, pos) {
    if (node.type.name !== "codeBlock") {
      return true;
    }

    const language = normalizeCodeBlockLanguage(node.attrs.language);
    if (!language) {
      return false;
    }

    const text = node.textContent || "";
    const contentStart = pos + 1;
    tokenizeCodeBlock(text, language).forEach(function (token) {
      decorations.push(Decoration.inline(contentStart + token.from, contentStart + token.to, {
        class: `wiki-code-token wiki-code-token--${token.type}`
      }));
    });
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

function isCodeBlockNode(node) {
  return !!(node && node.type && node.type.name === "codeBlock");
}

function positionTouchesCodeBlock(doc, pos) {
  const clampedPos = Math.max(0, Math.min(pos, doc.content.size));
  const directNode = doc.nodeAt(clampedPos);
  if (isCodeBlockNode(directNode)) {
    return true;
  }

  const resolved = doc.resolve(clampedPos);
  for (let depth = resolved.depth; depth > 0; depth -= 1) {
    if (isCodeBlockNode(resolved.node(depth))) {
      return true;
    }
  }
  return false;
}

function rangeTouchesCodeBlock(doc, from, to) {
  const start = Math.max(0, Math.min(from, doc.content.size));
  const end = Math.max(start, Math.min(to, doc.content.size));
  if (positionTouchesCodeBlock(doc, start) || positionTouchesCodeBlock(doc, end)) {
    return true;
  }

  let touched = false;
  doc.nodesBetween(start, end, function (node) {
    if (isCodeBlockNode(node)) {
      touched = true;
      return false;
    }
    return !touched;
  });
  return touched;
}

function transactionTouchesCodeBlock(transaction, oldState, newState) {
  let touched = false;
  transaction.mapping.maps.forEach(function (map) {
    map.forEach(function (oldStart, oldEnd, newStart, newEnd) {
      if (
        rangeTouchesCodeBlock(oldState.doc, oldStart, oldEnd) ||
        rangeTouchesCodeBlock(newState.doc, newStart, newEnd)
      ) {
        touched = true;
      }
    });
  });

  if (touched) {
    return true;
  }

  return transaction.steps.some(function (step) {
    return Number.isInteger(step.pos) &&
      (positionTouchesCodeBlock(oldState.doc, step.pos) || positionTouchesCodeBlock(newState.doc, step.pos));
  });
}

function readLanguageFromElement(element, prefix) {
  const candidates = [
    element && element.firstElementChild,
    element
  ].filter(Boolean);

  for (const candidate of candidates) {
    const classNames = Array.from(candidate.classList || []);
    const languageClass = classNames.find(function (className) {
      return className.startsWith(prefix);
    });
    const language = languageClass ? normalizeCodeBlockLanguage(languageClass.slice(prefix.length)) : null;
    if (language) {
      return language;
    }
  }
  return null;
}

const WikiCodeBlock = CodeBlock.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      languageClassPrefix: "language-"
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      language: {
        default: null,
        parseHTML: element => readLanguageFromElement(element, this.options.languageClassPrefix),
        rendered: false
      }
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const language = normalizeCodeBlockLanguage(node.attrs.language);
    return [
      "pre",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      [
        "code",
        {
          class: language ? `${this.options.languageClassPrefix}${language}` : null
        },
        0
      ]
    ];
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setCodeBlockLanguage: language => ({ commands, editor }) => {
        if (!editor.isActive(this.name)) {
          return false;
        }
        return commands.updateAttributes(this.name, {
          language: normalizeCodeBlockLanguage(language)
        });
      }
    };
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        key: new PluginKey("wikiCodeBlockSyntaxHighlighting"),
        state: {
          init: (_, state) => buildSyntaxDecorations(state.doc),
          apply: (transaction, oldDecorations, oldState, newState) => {
            if (!transaction.docChanged || !transactionTouchesCodeBlock(transaction, oldState, newState)) {
              return oldDecorations.map(transaction.mapping, transaction.doc);
            }
            return buildSyntaxDecorations(transaction.doc);
          }
        },
        props: {
          decorations(state) {
            return this.getState(state);
          }
        }
      })
    ];
  }
});

export default WikiCodeBlock;
