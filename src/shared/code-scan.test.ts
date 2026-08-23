import { describe, it, expect } from "vitest";
import {
  scanSegments,
  stripComments,
  findUnbalancedBracket,
} from "./code-scan";

describe("code-scan", () => {
  describe("scanSegments", () => {
    it("classifies single-quoted strings", () => {
      const segs = scanSegments("a = 'hello'");
      const types = segs.map((s) => s.type);
      expect(types).toContain("string");
    });

    it("classifies double-quoted strings and respects escapes", () => {
      const segs = scanSegments('a = "he\\"llo"');
      const strings = segs.filter((s) => s.type === "string");
      expect(strings).toHaveLength(1);
      expect(strings[0].end - strings[0].start).toBeGreaterThan(7);
    });

    it("classifies template literals with nested ${} expressions", () => {
      const code = "const s = `a${ 1 + b({c}) }b`;";
      const segs = scanSegments(code);
      // Every byte of the source must end up in exactly one segment
      let total = 0;
      for (const seg of segs) {
        total += seg.end - seg.start;
      }
      expect(total).toBe(code.length);
      // The literal's contents (without the surrounding backticks) must
      // round-trip when the original byte ranges are concatenated.
      const reconstructed = segs
        .map((s) => code.slice(s.start, s.end))
        .join("");
      expect(reconstructed).toBe(code);
      // At least one template segment must exist
      expect(segs.some((s) => s.type === "template")).toBe(true);
    });

    it("handles nested templates inside ${}", () => {
      const code = "const s = `${ `inner` }`";
      const segs = scanSegments(code);
      const templates = segs.filter((s) => s.type === "template");
      // The inner backticked text is recognised as its own template
      expect(templates.some((s) => code.slice(s.start, s.end) === "`inner`")).toBe(
        true,
      );
      // The full source still round-trips
      expect(
        segs.map((s) => code.slice(s.start, s.end)).join(""),
      ).toBe(code);
    });

    it("classifies line and block comments", () => {
      const segs = scanSegments("// l\na /* b */ b");
      const types = segs.map((s) => s.type).filter(Boolean);
      expect(types.filter((t) => t === "comment")).toHaveLength(2);
    });

    it("recognises a regex literal at expression start", () => {
      const code = "const r = /foo/gi; a / c";
      const segs = scanSegments(code);
      expect(segs.find((s) => s.type === "regex")).toBeDefined();
    });

    it("treats / after an identifier as division", () => {
      const code = "const x = a / b";
      const segs = scanSegments(code);
      expect(segs.find((s) => s.type === "regex")).toBeUndefined();
    });
  });

  describe("stripComments", () => {
    it("removes block comments but preserves a newline", () => {
      const out = stripComments("a /* x\nx */ b");
      expect(out).not.toContain("/*");
      expect(out).not.toContain("*/");
      expect(out).toContain("\n");
    });

    it("removes line comments", () => {
      expect(stripComments("a; // nope\nb")).toBe("a; \nb");
    });

    it("keeps string contents intact", () => {
      expect(stripComments("a = '// not a comment'")).toBe(
        "a = '// not a comment'",
      );
    });

    it("keeps regex literals intact", () => {
      const out = stripComments("const r = /abc/; // comment");
      expect(out).toContain("/abc/");
    });
  });

  describe("findUnbalancedBracket", () => {
    it("returns null when brackets balance", () => {
      expect(findUnbalancedBracket("function f(a, b) { return [a, b]; }")).toBeNull();
      expect(findUnbalancedBracket("a + (b * (c + d))")).toBeNull();
    });

    it("reports an unexpected closing bracket", () => {
      const r = findUnbalancedBracket("a ) b");
      expect(r).not.toBeNull();
      expect(r?.kind).toBe("unexpected");
      expect(r?.char).toBe(")");
    });

    it("reports an unclosed bracket", () => {
      const r = findUnbalancedBracket("function f( a, b");
      expect(r).not.toBeNull();
      expect(r?.kind).toBe("unclosed");
      expect(r?.char).toBe("(");
    });

    it("ignores brackets inside strings", () => {
      expect(findUnbalancedBracket("a = '))'")).toBeNull();
    });

    it("ignores brackets inside comments", () => {
      expect(findUnbalancedBracket("// ) }\na")).toBeNull();
    });

    it("ignores brackets inside template literal text portions", () => {
      expect(findUnbalancedBracket("const s = `)}`; a")).toBeNull();
    });
  });
});