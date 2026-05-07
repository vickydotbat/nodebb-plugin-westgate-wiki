import { mergeAttributes, Node } from "@tiptap/core";

import { getFigureImageElement, getFigureImageLinkElement } from "../normalization/legacy-html.mjs";
import { ALLOWED_IMAGE_FIGURE_CLASSES, normalizeClassTokens } from "../shared/image-class-contract.mjs";

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
  }
});

export default ImageFigure;
