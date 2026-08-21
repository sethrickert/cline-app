import type { AccentId } from "../types";

export const ACCENTS: Record<Exclude<AccentId, "custom">, string> = {
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
  accentId: "coral",
  customAccent: "#ff705f",
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
  return theme.accentId === "custom" ? theme.customAccent : ACCENTS[theme.accentId];
}

export function applyTheme(theme: ThemePreference, root: HTMLElement = document.documentElement) {
  const accent = resolveAccent(theme);
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-soft", `color-mix(in srgb, ${accent} 16%, transparent)`);
  root.style.setProperty("--accent-border", `color-mix(in srgb, ${accent} 42%, var(--border))`);
  root.style.colorScheme = "dark";
}

export function saveTheme(theme: ThemePreference, storage: Pick<Storage, "setItem"> = localStorage) {
  storage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
}

