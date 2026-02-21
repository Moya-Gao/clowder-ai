/**
 * Color utilities for dynamic cat theme rendering.
 * Converts hex colors from API to rgba for glow/shadow effects.
 */

/** Convert hex color (3/6/8 digit) to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '');
  let r: number, g: number, b: number;
  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
  } else {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  }
  return `rgba(${r},${g},${b},${alpha})`;
}
