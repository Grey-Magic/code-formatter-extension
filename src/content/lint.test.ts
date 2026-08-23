import { describe, it, expect } from "vitest";
import {
  computeDiagnostics,
  createLintExtension,
  isLintable,
} from "./lint";
import { jsonErrorOffset } from "./lint";

describe("lint", () => {
  describe("jsonErrorOffset", () => {
    it("extracts a V8 position offset", () => {
      const code = '{"a": }';
      const off = jsonErrorOffset("Unexpected token } in JSON at position 6", code);
      expect(off).toBe(6);
    });

    it("extracts a line/column offset and converts to a doc index", () => {
      const code = '{\n  "a": 1,\n  bad\n}';
      const off = jsonErrorOffset(
        "JSON.parse: expected property at line 3 column 3 of the JSON data",
        code,
      );
      expect(off).toBeGreaterThan(0);
    });

    it("falls back to offset 0 when no position is in the message", () => {
      expect(jsonErrorOffset("Generic parse error", "{ bad")).toBe(0);
    });
  });

  describe("computeDiagnostics", () => {
    it("returns no diagnostics for valid JSON", () => {
      expect(computeDiagnostics('{"a":1}', "json")).toEqual([]);
    });

    it("reports an error for invalid JSON", () => {
      const diags = computeDiagnostics('{"a": }', "json");
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe("error");
      expect(diags[0].source).toBe("json");
    });

    it("reports unclosed brackets for js-like code", () => {
      const diags = computeDiagnostics("function f(a, b {", "javascript");
      expect(diags).toHaveLength(1);
      expect(diags[0].message).toMatch(/Unclosed/);
    });

    it("reports unexpected closing brackets for js-like code", () => {
      const diags = computeDiagnostics("a ) b", "javascript");
      expect(diags).toHaveLength(1);
      expect(diags[0].message).toMatch(/Unexpected/);
    });

    it("does not report brackets inside strings", () => {
      expect(computeDiagnostics("a = '))'", "javascript")).toEqual([]);
    });

    it("does not lint unsupported languages", () => {
      expect(computeDiagnostics(")(", "ruby")).toEqual([]);
    });

    it("skips noisy html/xml bracket diagnostics", () => {
      // Unbalanced markup is normal for partial fragments
      expect(computeDiagnostics("<div>", "html")).toEqual([]);
    });
  });

  describe("createLintExtension", () => {
    it("returns extensions for lintable languages", () => {
      expect(createLintExtension("json")).toHaveLength(2); // gutter + linter
      expect(createLintExtension("javascript")).toHaveLength(2);
    });

    it("returns no extensions for non-lintable languages", () => {
      expect(createLintExtension("ruby")).toEqual([]);
    });
  });

  describe("isLintable", () => {
    it("knows its supported set", () => {
      expect(isLintable("json")).toBe(true);
      expect(isLintable("javascript")).toBe(true);
      expect(isLintable("ruby")).toBe(false);
    });
  });
});