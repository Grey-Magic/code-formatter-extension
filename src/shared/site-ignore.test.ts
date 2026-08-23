import { describe, it, expect } from "vitest";
import { isSiteIgnored, normalizeSitePattern } from "./utils";

describe("normalizeSitePattern", () => {
  it("lowercases and trims", () => {
    expect(normalizeSitePattern("  Example.COM  ")).toBe("example.com");
  });

  it("drops schemes and paths", () => {
    expect(normalizeSitePattern("https://foo.com/path?q=1")).toBe("foo.com");
    expect(normalizeSitePattern("//foo.com/abc")).toBe("foo.com");
  });

  it("returns null for empty input", () => {
    expect(normalizeSitePattern("")).toBeNull();
    expect(normalizeSitePattern("   ")).toBeNull();
  });
});

describe("isSiteIgnored", () => {
  it("returns false for empty patterns", () => {
    expect(isSiteIgnored("foo.com", [])).toBe(false);
  });

  it("matches an exact host", () => {
    expect(isSiteIgnored("foo.com", ["foo.com"])).toBe(true);
    expect(isSiteIgnored("bar.com", ["foo.com"])).toBe(false);
  });

  it("is case-insensitive on both sides", () => {
    expect(isSiteIgnored("Foo.COM", ["foo.com"])).toBe(true);
  });

  it("matches the base host under *. wildcard", () => {
    expect(isSiteIgnored("example.com", ["*.example.com"])).toBe(true);
    expect(isSiteIgnored("a.example.com", ["*.example.com"])).toBe(true);
    expect(isSiteIgnored("a.b.example.com", ["*.example.com"])).toBe(true);
  });

  it("rejects unrelated hosts under *. wildcard", () => {
    expect(isSiteIgnored("notexample.com", ["*.example.com"])).toBe(false);
  });

  it("treats garbage entries as no match", () => {
    expect(isSiteIgnored("foo.com", ["", "   "])).toBe(false);
  });

  it("handles mixed patterns", () => {
    const patterns = ["exact.example.com", "*.another.com"];
    expect(isSiteIgnored("exact.example.com", patterns)).toBe(true);
    expect(isSiteIgnored("x.another.com", patterns)).toBe(true);
    expect(isSiteIgnored("another.com", patterns)).toBe(true);
    expect(isSiteIgnored("elsewhere.org", patterns)).toBe(false);
  });
});