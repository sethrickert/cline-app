import type { AccentId } from "../types";

export const ACCENTS: Record<Exclude<AccentId, "custom">, string> = {
  pacific: "#1CA9C9",
  coral: "#ff705f",
  violet: "#9b7bff",
  azure: "#50a7ff",
  mint: "#43c59e",
  amber: "#e9a84c",
};

export const THEME_STORAGE_KEY = "cline-chat.theme.v1";

export type ThemePreference = {
  accentId: AccentId;
  customAccent: string;
};

export const DEFAULT_THEME: ThemePreference = {
  accentId: "pacific",
  customAccent: "#1CA9C9",
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function loadTheme(storage: Pick<Storage, "getItem"> = localStorage): ThemePreference {
  try {
    const parsed = JSON.parse(storage.getItem(THEME_STORAGE_KEY) ?? "null") as Partial<ThemePreference> | null;
    if (!parsed) return DEFAULT_THEME;
    const accentId = parsed.accentId && (parsed.accentId === "custom" || parsed.accentId in ACCENTS) ? parsed.accentId : DEFAULT_THEME.accentId;
    const customAccent = typeof parsed.customAccent === "string" && HEX_COLOR.test(parsed.customAccent) ? parsed.customAccent : DEFAULT_THEME.customAccent;
    return { accentId, customAccent };
  } catch {
    return DEFAULT_THEME;
  }
}

export function resolveAccent(theme: ThemePreference): string {
  if (theme.accentId === "custom") return HEX_COLOR.test(theme.customAccent) ? theme.customAccent : DEFAULT_THEME.customAccent;
  return ACCENTS[theme.accentId] ?? ACCENTS.pacific;
}

export function normalizeHexColor(value: string): string | undefined {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  return HEX_COLOR.test(prefixed) ? prefixed.toUpperCase() : undefined;
}

export function applyTheme(theme: ThemePreference, root: HTMLElement = document.documentElement) {
  const accent = resolveAccent(theme);
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-soft", `color-mix(in srgb, ${accent} 16%, transparent)`);
  root.style.setProperty("--accent-border", `color-mix(in srgb, ${accent} 42%, var(--border))`);
  root.style.colorScheme = "dark";
}

export function saveTheme(theme: ThemePreference, storage: Pick<Storage, "setItem"> = localStorage) {
  try { storage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme)); } catch { /* Appearance changes must never interrupt chat. */ }
}

