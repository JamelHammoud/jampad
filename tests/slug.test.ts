import { describe, it, expect } from "vitest";
import {
  slugToHref,
  slugEqual,
  slugStartsWith,
  decodeSlug,
  slugifyFileName,
} from "@/lib/slug";

describe("slugToHref", () => {
  it("joins and prefixes with /", () => {
    expect(slugToHref(["getting-started"])).toBe("/getting-started");
    expect(slugToHref(["docs", "intro"])).toBe("/docs/intro");
  });

  it("URL-encodes special characters", () => {
    expect(slugToHref(["hello world"])).toBe("/hello%20world");
    expect(slugToHref(["a/b"])).toBe("/a%2Fb");
  });

  it("handles empty slug", () => {
    expect(slugToHref([])).toBe("/");
  });
});

describe("slugEqual", () => {
  it("returns true for identical slugs", () => {
    expect(slugEqual(["a", "b"], ["a", "b"])).toBe(true);
    expect(slugEqual([], [])).toBe(true);
  });

  it("returns false for different lengths", () => {
    expect(slugEqual(["a"], ["a", "b"])).toBe(false);
  });

  it("returns false for different parts", () => {
    expect(slugEqual(["a", "b"], ["a", "c"])).toBe(false);
  });
});

describe("slugStartsWith", () => {
  it("returns true when prefix matches", () => {
    expect(slugStartsWith(["a", "b", "c"], ["a", "b"])).toBe(true);
    expect(slugStartsWith(["a"], [])).toBe(true);
  });

  it("returns false when prefix is longer than slug", () => {
    expect(slugStartsWith(["a"], ["a", "b"])).toBe(false);
  });

  it("returns false when prefix diverges", () => {
    expect(slugStartsWith(["a", "b"], ["a", "c"])).toBe(false);
  });
});

describe("decodeSlug", () => {
  it("decodes URI-encoded segments", () => {
    expect(decodeSlug(["hello%20world"])).toEqual(["hello world"]);
    expect(decodeSlug(["a%2Fb", "c"])).toEqual(["a/b", "c"]);
  });
});

describe("slugifyFileName", () => {
  it("converts spaces to dashes", () => {
    expect(slugifyFileName("Hello World")).toBe("Hello-World");
  });

  it("strips diacritics", () => {
    expect(slugifyFileName("Café Crème")).toBe("Cafe-Creme");
  });

  it("drops special characters", () => {
    expect(slugifyFileName("My! Page? #1")).toBe("My-Page-1");
  });

  it("preserves underscores and existing dashes", () => {
    expect(slugifyFileName("snake_case-kebab")).toBe("snake_case-kebab");
  });

  it("falls back to page-<timestamp> when input is empty or all-special", () => {
    expect(slugifyFileName("").startsWith("page-")).toBe(true);
    expect(slugifyFileName("!!!").startsWith("page-")).toBe(true);
    expect(slugifyFileName("   ").startsWith("page-")).toBe(true);
  });

  it("collapses consecutive whitespace", () => {
    expect(slugifyFileName("a   b  c")).toBe("a-b-c");
  });
});
