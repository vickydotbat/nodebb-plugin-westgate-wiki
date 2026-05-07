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
  const sizeClasses = new Set([
    "wiki-image-size-sm",
    "wiki-image-size-md",
    "wiki-image-size-lg",
    "wiki-image-size-full"
  ]);

  if (nodeName === "imageFigure") {
    const hasImageClass = /\bimage\b/.test(currentClass);
    const retained = removeClassTokens(currentClass, sizeClasses);
    const sizeClass = {
      sm: "wiki-image-size-sm",
      md: "wiki-image-size-md",
      lg: "wiki-image-size-lg",
      full: "wiki-image-size-full"
    }[size] || "";
    const base = hasImageClass ? retained : `image ${retained}`.trim();
    return sizeClass ? `${base} ${sizeClass}`.trim() : base.trim();
  }

  const retained = removeClassTokens(currentClass, sizeClasses);
  const sizeClass = {
    sm: "wiki-image-size-sm",
    md: "wiki-image-size-md",
    lg: "wiki-image-size-lg",
    full: "wiki-image-size-full"
  }[size] || "";
  return sizeClass ? `${retained} ${sizeClass}`.trim() : retained.trim();
}
