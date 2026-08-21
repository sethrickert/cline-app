import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, loadTheme, resolveAccent } from "./theme";

describe("theme preferences", () => {
  it("falls back safely when persisted data is invalid", () => {
    expect(loadTheme({ getItem: () => "not json" })).toEqual(DEFAULT_THEME);
  });

  it("resolves preset and custom colors", () => {
    expect(resolveAccent({ accentId: "azure", customAccent: "#ffffff" })).toBe("#50a7ff");
    expect(resolveAccent({ accentId: "custom", customAccent: "#123456" })).toBe("#123456");
  });
});

