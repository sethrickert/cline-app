import type { AppPreferences } from "../types";

const STORAGE_KEY = "cline-chat-preferences-v1";

export const DEFAULT_PREFERENCES: AppPreferences = {
  sendWithEnter: true,
  showTimestamps: true,
  autoCheckUpdates: true,
  favoriteModelIds: [],
  pinnedConversationIds: [],
};

export function loadPreferences(): AppPreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<AppPreferences>;
    return {
      sendWithEnter: stored.sendWithEnter ?? DEFAULT_PREFERENCES.sendWithEnter,
      showTimestamps: stored.showTimestamps ?? DEFAULT_PREFERENCES.showTimestamps,
      autoCheckUpdates: stored.autoCheckUpdates ?? DEFAULT_PREFERENCES.autoCheckUpdates,
      profilePhoto: typeof stored.profilePhoto === "string" ? stored.profilePhoto : undefined,
      profilePhotoCrop: stored.profilePhotoCrop && typeof stored.profilePhotoCrop.x === "number" && typeof stored.profilePhotoCrop.y === "number" && typeof stored.profilePhotoCrop.zoom === "number" ? stored.profilePhotoCrop : undefined,
      favoriteModelIds: Array.isArray(stored.favoriteModelIds) ? stored.favoriteModelIds.filter((id): id is string => typeof id === "string") : [],
      pinnedConversationIds: Array.isArray(stored.pinnedConversationIds) ? stored.pinnedConversationIds.filter((id): id is string => typeof id === "string") : [],
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: AppPreferences) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch { /* Keep the app usable if local profile data exceeds storage limits. */ }
}
