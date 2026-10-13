/**
 * Dynamic User Theme & Color Management
 * Reads theme colors & display settings dynamically from Firebase,
 * with deterministic fallback for any new or unthemed participants.
 */

export interface UserTheme {
  hex: string;
  rgb: string;
  stroke: string;
  bg: string;
  fill: string;
  border: string;
  glow: string;
}

const PALETTE: string[] = [
  '#818cf8', // Indigo
  '#f59e0b', // Amber
  '#c084fc', // Purple
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#f43f5e', // Rose
  '#38bdf8', // Sky
  '#8b5cf6', // Violet
  '#fb923c', // Orange
  '#14b8a6', // Teal
];

/**
 * Converts a hex code to an RGB string (e.g. "99, 102, 241")
 */
export function hexToRgb(hex: string): string {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return '99, 102, 241';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

/**
 * Generates a consistent, deterministic hex color based on username hash
 */
export function hashStringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

/**
 * Returns full theme styling for any user, prioritizing their Firebase themeColor
 */
export function getUserTheme(username: string, customColor?: string): UserTheme {
  const hex = (customColor && customColor.startsWith('#'))
    ? customColor
    : customColor
    ? `#${customColor}`
    : hashStringToColor(username);

  const rgb = hexToRgb(hex);

  return {
    hex,
    rgb,
    stroke: hex,
    bg: `rgba(${rgb}, 0.15)`,
    fill: hex,
    border: `rgba(${rgb}, 0.3)`,
    glow: `rgba(${rgb}, 0.5)`,
  };
}

/**
 * Resolves user display name dynamically from Firebase records,
 * with clean title-case fallback.
 */
export function resolveDisplayName(
  username: string,
  userMap?: Record<string, string | { displayName?: string } | undefined>
): string {
  if (userMap && userMap[username]) {
    const val = userMap[username];
    if (typeof val === 'string' && val.trim()) return val;
    if (typeof val === 'object' && val?.displayName) return val.displayName;
  }

  // Fallback: title-case the username
  const clean = username.replace(/_+/g, ' ').replace(/[0-9]+$/g, '');
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

