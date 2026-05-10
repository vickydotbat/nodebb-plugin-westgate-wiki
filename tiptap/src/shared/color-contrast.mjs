export const DARK_TEXT_COLOR = "#111827";
export const LIGHT_TEXT_COLOR = "#f9fafb";

export function normalizeHexColor(value) {
  const match = String(value || "").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return "";
  }

  let hex = match[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex.split("").map(function (channel) {
      return channel + channel;
    }).join("");
  }
  return `#${hex}`;
}

function hexToRgb(value) {
  const hex = normalizeHexColor(value);
  if (!hex) {
    return null;
  }
  const intValue = Number.parseInt(hex.slice(1), 16);
  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255
  };
}

function channelToLinear(value) {
  const channel = value / 255;
  return channel <= 0.03928 ?
    channel / 12.92 :
    Math.pow((channel + 0.055) / 1.055, 2.4);
}

function relativeLuminance(value) {
  const rgb = hexToRgb(value);
  if (!rgb) {
    return null;
  }
  return (
    0.2126 * channelToLinear(rgb.r) +
    0.7152 * channelToLinear(rgb.g) +
    0.0722 * channelToLinear(rgb.b)
  );
}

function contrastRatio(firstColor, secondColor) {
  const first = relativeLuminance(firstColor);
  const second = relativeLuminance(secondColor);
  if (first === null || second === null) {
    return 0;
  }
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getReadableTextColor(backgroundColor) {
  const background = normalizeHexColor(backgroundColor);
  if (!background) {
    return DARK_TEXT_COLOR;
  }

  return contrastRatio(background, DARK_TEXT_COLOR) >= contrastRatio(background, LIGHT_TEXT_COLOR) ?
    DARK_TEXT_COLOR :
    LIGHT_TEXT_COLOR;
}
