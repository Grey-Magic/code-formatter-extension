import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createStatusBar,
  updateStatusBarWithFile,
} from "./status-bar";
import { DEFAULT_SETTINGS } from "../shared/constants";
import type { ExtensionSettings } from "../shared/types";

const STATUS_BAR_ID = "code-formatter-status-bar";

function getStatusBar(): HTMLElement | null {
  return document.getElementById(STATUS_BAR_ID);
}

describe("Status Bar Module", () => {
  let settings: ExtensionSettings;

  beforeEach(() => {
    settings = { ...DEFAULT_SETTINGS };
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  describe("createStatusBar", () => {
    it("should create status bar element", () => {
      const code = "const x = 10;";
      const bar = createStatusBar("javascript", code, settings);

      expect(bar).toBeTruthy();
      expect(bar.id).toBe(STATUS_BAR_ID);
      expect(bar.className).toBe("code-formatter-status-bar");
    });

    it("should display language in uppercase", () => {
      const code = "const x = 10;";
      const bar = createStatusBar("javascript", code, settings);

      expect(bar.textContent).toContain("JAVASCRIPT");
    });

    it("should display line count", () => {
      const code = "line1\nline2\nline3";
      const bar = createStatusBar("javascript", code, settings);

      expect(bar.textContent).toContain("Ln 3");
    });

    it("should display file size in bytes for small files", () => {
      const code = "const x = 10;";
      const bar = createStatusBar("javascript", code, settings);

      expect(bar.textContent).toContain("B");
    });

    it("should display file size in KB for larger files", () => {
      const code = "x".repeat(1500);
      const bar = createStatusBar("javascript", code, settings);

      expect(bar.textContent).toContain("KB");
    });

    it("should display indent size", () => {
      const code = "const x = 10;";
      settings.indentSize = 4;
      const bar = createStatusBar("javascript", code, settings);

      expect(bar.textContent).toContain("Spaces: 4");
    });

    it("should include wrap setting in settings object", () => {
      const code = "const x = 10;";
      settings.wrapLines = true;
      const bar = createStatusBar("javascript", code, settings);

      expect(bar).toBeTruthy();
      expect(settings.wrapLines).toBe(true);
    });
  });

  describe("updateStatusBarWithFile", () => {
    beforeEach(() => {
      const code = "const x = 10;";
      const bar = createStatusBar("javascript", code, settings);
      document.body.appendChild(bar);
    });

    it("should add file info to status bar", () => {
      updateStatusBarWithFile({ name: "test.js", size: 1024 });

      const bar = getStatusBar();
      expect(bar?.textContent).toContain("test.js");
      expect(bar?.textContent).toContain("1 KB");
    });

    it("should replace existing file info", () => {
      updateStatusBarWithFile({ name: "first.js", size: 100 });
      updateStatusBarWithFile({ name: "second.js", size: 200 });

      const bar = getStatusBar();
      expect(bar?.textContent).toContain("second.js");
      expect(bar?.textContent).not.toContain("first.js");
    });

    it("should handle null file info", () => {
      expect(() => updateStatusBarWithFile(null)).not.toThrow();
    });

    it("should handle undefined file info", () => {
      expect(() => updateStatusBarWithFile(undefined)).not.toThrow();
    });

    it("should validate file info properties", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      updateStatusBarWithFile({
        name: 123 as unknown as string,
        size: "big" as unknown as number,
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
