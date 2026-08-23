import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  detectLanguage,
  appearsToBeCodePage,
  DETECTION_PATTERNS,
} from "./detection";

describe("Detection Module", () => {
  describe("DETECTION_PATTERNS", () => {
    it("should have patterns for common languages", () => {
      const languages = DETECTION_PATTERNS.map((p) => p.lang);
      expect(languages).toContain("javascript");
      expect(languages).toContain("typescript");
      expect(languages).toContain("python");
      expect(languages).toContain("go");
      expect(languages).toContain("rust");
      expect(languages).toContain("sql");
      expect(languages).toContain("html");
      expect(languages).toContain("css");
    });

    it("should have weight property for all patterns", () => {
      for (const pattern of DETECTION_PATTERNS) {
        expect(pattern.weight).toBeGreaterThan(0);
        expect(pattern.weight).toBeLessThanOrEqual(10);
      }
    });

    it("should have valid regex for all patterns", () => {
      for (const pattern of DETECTION_PATTERNS) {
        expect(pattern.regex).toBeInstanceOf(RegExp);
      }
    });
  });

  describe("detectLanguage", () => {
    it("should detect JSON objects", () => {
      const json = '{"name": "test", "value": 123}';
      expect(detectLanguage(json)).toBe("json");
    });

    it("should detect JSON arrays", () => {
      const json = '[1, 2, 3, {"key": "value"}]';
      expect(detectLanguage(json)).toBe("json");
    });

    it("should not detect invalid JSON", () => {
      const notJson = '{"missing": "quote}';
      expect(detectLanguage(notJson)).not.toBe("json");
    });

    it("should detect HTML", () => {
      const html = "<!DOCTYPE html><html><body>Hello</body></html>";
      expect(detectLanguage(html)).toBe("html");
    });

    it("should return null for empty content", () => {
      expect(detectLanguage("")).toBeNull();
      expect(detectLanguage("   ")).toBeNull();
    });

    it("should detect code patterns", () => {
      const code = `
        interface User { name: string; }
        def hello(): pass
        package main
        fn main() {}
        SELECT * FROM table
      `;
      const result = detectLanguage(code);
      expect(result).not.toBeNull();
    });
  });
});

describe("appearsToBeCodePage", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("should return false for empty page", () => {
    expect(appearsToBeCodePage()).toBe(false);
  });

  it("should return true when pre element has language class", () => {
    const pre = document.createElement("pre");
    pre.className = "language-javascript";
    pre.textContent = "const x = 10;".repeat(20);
    document.body.appendChild(pre);

    expect(appearsToBeCodePage()).toBe(true);
  });

  it("should return true when code element has language class", () => {
    const code = document.createElement("code");
    code.className = "language-python";
    code.textContent = "def hello(): pass".repeat(20);
    document.body.appendChild(code);

    expect(appearsToBeCodePage()).toBe(true);
  });

  it("should return true for shebang scripts", () => {
    const pre = document.createElement("pre");
    pre.textContent = "#!/bin/bash\necho 'hello'".repeat(10);
    document.body.appendChild(pre);

    expect(appearsToBeCodePage()).toBe(true);
  });

  it("should return false for short content", () => {
    const pre = document.createElement("pre");
    pre.textContent = "short";
    document.body.appendChild(pre);

    expect(appearsToBeCodePage()).toBe(false);
  });

  it("should return false on large pages quickly (does not scan everything)", () => {
    // Create way more than the scan cap to exercise the perf guard
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 200; i++) {
      const pre = document.createElement("pre");
      pre.textContent = "x";
      frag.appendChild(pre);
    }
    document.body.appendChild(frag);

    const t0 = Date.now();
    const result = appearsToBeCodePage();
    const elapsed = Date.now() - t0;
    expect(result).toBe(false);
    expect(elapsed).toBeLessThan(500);
  });
});

describe("detectLanguage shebang mapping", () => {
  it("maps python shebang to python", () => {
    expect(detectLanguage("#!/usr/bin/env python3\nprint('hi')")).toBe("python");
  });

  it("maps node shebang to javascript", () => {
    expect(detectLanguage("#!/usr/bin/env node\nconsole.log(1)")).toBe("javascript");
  });

  it("maps bash shebang to bash", () => {
    expect(detectLanguage("#!/bin/bash\necho hi")).toBe("bash");
  });
});

describe("detectLanguage new patterns", () => {
  it("recognises Dockerfile FROM", () => {
    expect(detectLanguage("FROM node:18\nRUN npm install")).toBe("dockerfile");
  });

  it("recognises XML by xmlns attribute", () => {
    expect(detectLanguage('<root xmlns="urn:x"></root>')).toBe("xml");
  });

  it("recognises dotenv style KEY=VALUE pairs", () => {
    expect(detectLanguage("FOO=bar\nBAZ=qux\nLOREM=value")).toBe("dotenv");
  });
});
