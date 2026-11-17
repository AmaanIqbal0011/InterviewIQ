import { describe, expect, it } from "vitest";
import { resolveDisplayName } from "@/lib/displayName";

describe("resolveDisplayName", () => {
  it("prefers user_metadata.full_name over every other source", () => {
    expect(resolveDisplayName({ full_name: "Ada Lovelace", name: "Ada" }, "ada@example.com")).toBe(
      "Ada Lovelace",
    );
  });

  it("falls back to user_metadata.name when full_name is missing", () => {
    expect(resolveDisplayName({ name: "Ada" }, "ada@example.com")).toBe("Ada");
  });

  it("falls back to the part of the email before the @", () => {
    expect(resolveDisplayName({}, "ada@example.com")).toBe("ada");
    expect(resolveDisplayName(undefined, "ada@example.com")).toBe("ada");
    expect(resolveDisplayName(null, "ada@example.com")).toBe("ada");
  });

  it("ignores empty or non-string metadata values", () => {
    expect(resolveDisplayName({ full_name: "   " }, "ada@example.com")).toBe("ada");
    expect(resolveDisplayName({ full_name: 42, name: null }, "ada@example.com")).toBe("ada");
  });

  it("trims surrounding whitespace from the chosen name", () => {
    expect(resolveDisplayName({ full_name: "  Ada L.  " }, "ada@example.com")).toBe("Ada L.");
  });

  it("returns an empty string when the account has nothing to show", () => {
    expect(resolveDisplayName({}, null)).toBe("");
    expect(resolveDisplayName({}, "")).toBe("");
  });
});
