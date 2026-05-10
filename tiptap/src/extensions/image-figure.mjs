import { mergeAttributes, Node } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

import { getFigureImageElement, getFigureImageLinkElement } from "../normalization/legacy-html.mjs";
import {
  ALLOWED_IMAGE_FIGURE_CLASSES,
  getFigureClassForImageNodeClass,
  getImageNodeClassForFigureClass,
  normalizeClassTokens
} from "../shared/image-class-contract.mjs";

export function getFigureImageAttrs(element) {
  const image = getFigureImageElement(element);
  const link = getFigureImageLinkElement(element);

  return {
    src: image ? image.getAttribute("src") || null : null,
    alt: image ? image.getAttribute("alt") || null : null,
    title: image ? image.getAttribute("title") || null : null,
    width: image ? image.getAttribute("width") || null : null,
    height: image ? image.getAttribute("height") || null : null,
    href: link ? link.getAttribute("href") || null : null,
    target: link ? link.getAttribute("target") || null : null,
    rel: link ? link.getAttribute("rel") || null : null,
    class: normalizeClassTokens(element.getAttribute("class"), ALLOWED_IMAGE_FIGURE_CLASSES, "image") || "image",
    id: element.getAttribute("id") || null
  };
}

function setOptionalAttribute(element, name, value) {
  if (value === undefined || value === null || value === "") {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, String(value));
  }
}

function applyFigureAttrs(dom, attrs, options) {
  dom.setAttribute("class", attrs.class || "image");
  dom.setAttribute("data-wiki-node", "image-figure");
  setOptionalAttribute(dom, "id", attrs.id);
  if (options && options.HTMLAttributes) {
    Object.entries(options.HTMLAttributes).forEach(function ([name, value]) {
      if (name !== "class" && name !== "id" && name !== "data-wiki-node") {
        setOptionalAttribute(dom, name, value);
      }
    });
  }
}

function renderImageMedia(media, attrs) {
  while (media.firstChild) {
    media.removeChild(media.firstChild);
  }

  const doc = media.ownerDocument;
  const img = doc.createElement("img");
  setOptionalAttribute(img, "src", attrs.src);
  setOptionalAttribute(img, "alt", attrs.alt);
  setOptionalAttribute(img, "title", attrs.title);
  setOptionalAttribute(img, "width", attrs.width);
  setOptionalAttribute(img, "height", attrs.height);

  if (attrs.href) {
    const link = doc.createElement("a");
    setOptionalAttribute(link, "href", attrs.href);
    setOptionalAttribute(link, "target", attrs.target);
    setOptionalAttribute(link, "rel", attrs.rel);
    link.appendChild(img);
    media.appendChild(link);
    return;
  }

  media.appendChild(img);
}

function findSelectedImageFigure(state, nodeTypeName) {
  const { selection } = state;
  if (selection && selection.node && selection.node.type.name === nodeTypeName) {
    return {
      node: selection.node,
      pos: selection.from
    };
  }

  const $from = selection && selection.$from;
  if (!$from) {
    return null;
  }
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node && node.type.name === nodeTypeName) {
      return {
        node,
        pos: $from.before(depth)
      };
    }
  }

  return null;
}

const ImageFigure = Node.create({
  name: "imageFigure",
  group: "block",
  content: "block*",
  draggable: true,
  isolating: true,
  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).src;
        }
      },
      alt: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).alt;
        }
      },
      title: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).title;
        }
      },
      width: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).width;
        }
      },
      height: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).height;
        }
      },
      href: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).href;
        }
      },
      target: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).target;
        }
      },
      rel: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).rel;
        }
      },
      class: {
        default: "image",
        parseHTML: function (element) {
          return getFigureImageAttrs(element).class;
        }
      },
      id: {
        default: null,
        parseHTML: function (element) {
          return getFigureImageAttrs(element).id;
        }
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: "figure.image",
        contentElement: function (element) {
          return element.querySelector("figcaption") || element.ownerDocument.createElement("div");
        }
      }
    ];
  },
  renderHTML({ HTMLAttributes, node }) {
    const {
      src,
      alt,
      title,
      width,
      height,
      href,
      target,
      rel,
      class: figureClass,
      id
    } = HTMLAttributes;

    const figureAttrs = mergeAttributes(
      this.options.HTMLAttributes || {},
      {
        class: figureClass || "image",
        "data-wiki-node": "image-figure"
      },
      id ? { id } : {}
    );
    const imageAttrs = { src };
    if (alt) {
      imageAttrs.alt = alt;
    }
    if (title) {
      imageAttrs.title = title;
    }
    if (width) {
      imageAttrs.width = width;
    }
    if (height) {
      imageAttrs.height = height;
    }

    const imageSpec = href
      ? ["a", mergeAttributes({ href }, target ? { target } : {}, rel ? { rel } : {}), ["img", imageAttrs]]
      : ["img", imageAttrs];

    if (node.childCount > 0) {
      return ["figure", figureAttrs, imageSpec, ["figcaption", 0]];
    }

    return ["figure", figureAttrs, imageSpec];
  },
  addNodeView() {
    return ({ node }) => {
      const doc = window.document;
      const dom = doc.createElement("figure");
      const media = doc.createElement("div");
      const caption = doc.createElement("figcaption");

      media.className = "wiki-image-figure__media";
      media.setAttribute("contenteditable", "false");
      media.setAttribute("draggable", "true");

      applyFigureAttrs(dom, node.attrs || {}, this.options);
      renderImageMedia(media, node.attrs || {});
      dom.appendChild(media);
      dom.appendChild(caption);

      return {
        dom,
        contentDOM: caption,
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) {
            return false;
          }
          applyFigureAttrs(dom, updatedNode.attrs || {}, this.options);
          renderImageMedia(media, updatedNode.attrs || {});
          return true;
        }
      };
    };
  },
  addCommands() {
    return {
      convertImageToFigure:
        () =>
        ({ state, dispatch }) => {
          const { selection } = state;
          const node = selection && selection.node;
          if (!node || node.type.name !== "image") {
            return false;
          }

          const imageFigureType = state.schema.nodes[this.name];
          if (!imageFigureType) {
            return false;
          }

          const paragraphType = state.schema.nodes.paragraph;
          if (!paragraphType) {
            return false;
          }

          const attrs = node.attrs || {};
          const figure = imageFigureType.create(
            {
              src: attrs.src || null,
              alt: attrs.alt || null,
              title: attrs.title || null,
              width: attrs.width || null,
              height: attrs.height || null,
              class: getFigureClassForImageNodeClass(attrs.class || ""),
              id: attrs.id || null
            },
            paragraphType.create()
          );
          if (!figure) {
            return false;
          }

          if (dispatch) {
            const insertPos = selection.from;
            const tr = state.tr.replaceSelectionWith(figure);
            dispatch(tr.setSelection(NodeSelection.create(tr.doc, insertPos)).scrollIntoView());
          }
          return true;
        },
      convertFigureToImage:
        () =>
        ({ state, dispatch }) => {
          const selected = findSelectedImageFigure(state, this.name);
          if (!selected) {
            return false;
          }

          const imageType = state.schema.nodes.image;
          if (!imageType) {
            return false;
          }

          const attrs = selected.node.attrs || {};
          const image = imageType.create({
            src: attrs.src || null,
            alt: attrs.alt || null,
            title: attrs.title || null,
            width: attrs.width || null,
            height: attrs.height || null,
            class: getImageNodeClassForFigureClass(attrs.class || ""),
            id: attrs.id || null
          });
          if (!image) {
            return false;
          }

          if (dispatch) {
            const tr = state.tr.replaceWith(selected.pos, selected.pos + selected.node.nodeSize, image);
            dispatch(tr.setSelection(NodeSelection.create(tr.doc, selected.pos)).scrollIntoView());
          }
          return true;
        }
    };
  }
});

export default ImageFigure;
