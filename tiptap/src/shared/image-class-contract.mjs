export const ALLOWED_IMAGE_FIGURE_CLASSES = new Set([
  "image",
  "image-style-side",
  "image-style-align-left",
  "image-style-align-right",
  "image-style-block",
  "wiki-image-size-sm",
  "wiki-image-size-md",
  "wiki-image-size-lg",
  "wiki-image-size-full"
]);

export const ALLOWED_IMAGE_NODE_CLASSES = new Set([
  "wiki-image-align-center",
  "wiki-image-align-left",
  "wiki-image-align-right",
  "wiki-image-align-side",
  "wiki-image-size-sm",
  "wiki-image-size-md",
  "wiki-image-size-lg",
  "wiki-image-size-full"
]);

export const IMAGE_SIZE_CLASSES = new Set([
  "wiki-image-size-sm",
  "wiki-image-size-md",
  "wiki-image-size-lg",
  "wiki-image-size-full"
]);

export function normalizeClassTokens(value, allowedSet, requiredToken) {
  const tokens = String(value || "")
    .split(/\s+/)
    .map(function (token) { return token.trim(); })
    .filter(Boolean)
    .filter(function (token) { return allowedSet.has(token); });

  if (requiredToken && !tokens.includes(requiredToken)) {
    tokens.unshift(requiredToken);
  }

  return Array.from(new Set(tokens)).join(" ").trim();
}

export function removeClassTokens(value, tokensToRemove) {
  return String(value || "")
    .split(/\s+/)
    .map(function (token) { return token.trim(); })
    .filter(Boolean)
    .filter(function (token) { return !tokensToRemove.has(token); })
    .join(" ")
    .trim();
}

export function removeImageSizeClasses(value) {
  return removeClassTokens(value, IMAGE_SIZE_CLASSES);
}

export function getFigureClassForImageNodeClass(value) {
  const className = String(value || "");
  const classes = ["image"];

  if (className.includes("wiki-image-align-left")) {
    classes.push("image-style-align-left");
  } else if (className.includes("wiki-image-align-right")) {
    classes.push("image-style-align-right");
  } else if (className.includes("wiki-image-align-side")) {
    classes.push("image-style-side");
  } else {
    classes.push("image-style-block");
  }

  IMAGE_SIZE_CLASSES.forEach(function (sizeClass) {
    if (className.includes(sizeClass)) {
      classes.push(sizeClass);
    }
  });

  return normalizeClassTokens(classes.join(" "), ALLOWED_IMAGE_FIGURE_CLASSES, "image") || "image";
}

export function getImageLayoutClassForNode(nodeName, currentClass, layout) {
  if (nodeName === "imageFigure") {
    const retained = removeClassTokens(currentClass, new Set([
      "image",
      "image-style-side",
      "image-style-align-left",
      "image-style-align-right",
      "image-style-block"
    ]));
    const layoutClass = {
      center: "image image-style-block",
      left: "image image-style-align-left",
      right: "image image-style-align-right",
      side: "image image-style-side"
    }[layout] || "image image-style-block";
    return retained ? `${retained} ${layoutClass}` : layoutClass;
  }

  const retained = removeClassTokens(currentClass, ALLOWED_IMAGE_NODE_CLASSES);
  const layoutClass = {
    center: "wiki-image-align-center",
    left: "wiki-image-align-left",
    right: "wiki-image-align-right",
    side: "wiki-image-align-side"
  }[layout] || "wiki-image-align-center";
  return retained ? `${retained} ${layoutClass}` : layoutClass;
}

export function getImageSizeClassForNode(nodeName, currentClass, size) {
  if (nodeName === "imageFigure") {
    const hasImageClass = /\bimage\b/.test(currentClass);
    const retained = removeClassTokens(currentClass, IMAGE_SIZE_CLASSES);
    const sizeClass = {
      sm: "wiki-image-size-sm",
      md: "wiki-image-size-md",
      lg: "wiki-image-size-lg",
      full: "wiki-image-size-full"
    }[size] || "";
    const base = hasImageClass ? retained : `image ${retained}`.trim();
    return sizeClass ? `${base} ${sizeClass}`.trim() : base.trim();
  }

  const retained = removeClassTokens(currentClass, IMAGE_SIZE_CLASSES);
  const sizeClass = {
    sm: "wiki-image-size-sm",
    md: "wiki-image-size-md",
    lg: "wiki-image-size-lg",
    full: "wiki-image-size-full"
  }[size] || "";
  return sizeClass ? `${retained} ${sizeClass}`.trim() : retained.trim();
}
