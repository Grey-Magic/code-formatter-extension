import { describe, it, expect } from "vitest";
import { MinifyFormatter } from "./minify";

const minify = new MinifyFormatter();

describe("MinifyFormatter", () => {
  describe("JSON", () => {
    it("re-serialises valid JSON compactly", async () => {
      const result = await minify.format(
        '{\n  "a": 1,\n  "b": [1, 2]\n}',
        "json",
      );
      expect(result.success).toBe(true);
      expect(result.code).toBe('{"a":1,"b":[1,2]}');
    });

    it("rejects invalid JSON", async () => {
      const result = await minify.format("{ broken", "json");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("CSS", () => {
    it("strips comments and collapses whitespace", async () => {
      const result = await minify.format(
        "/* header */\nbody {\n  color: red;\n  margin: 0;\n}",
        "css",
      );
      expect(result.success).toBe(true);
      expect(result.code).not.toContain("/*");
      expect(result.code).not.toContain("\n");
      // Space inside declarations (e.g. `color: red`) is kept because the
      // `:` can be a descendant+pseudo selector separator (`a :hover`) and
      // stripping the space would change its meaning.
      expect(result.code).toContain("color: red");
    });

    it("preserves spaces inside calc()", async () => {
      const result = await minify.format(
        "a { width: calc(100% - 20px); }",
        "css",
      );
      expect(result.success).toBe(true);
      expect(result.code).toContain("calc(100% - 20px)");
    });

    it("keeps string contents untouched", async () => {
      const result = await minify.format(
        'a::after { content: "  hi  "; }',
        "css",
      );
      expect(result.success).toBe(true);
      expect(result.code).toContain('"  hi  "');
    });
  });

  describe("HTML", () => {
    it("strips comments and collapses inter-tag whitespace", async () => {
      const result = await minify.format(
        "<!-- comment -->\n<div>  <p>hi</p>  </div>",
        "html",
      );
      expect(result.success).toBe(true);
      expect(result.code).not.toContain("<!--");
      expect(result.code).not.toContain(/\n/);
    });

    it("preserves <pre> and <script> contents verbatim", async () => {
      const html = "<pre>  spaced\n\n  text  </pre><script>var a =  1;</script>";
      const result = await minify.format(html, "html");
      expect(result.success).toBe(true);
      expect(result.code).toContain("<pre>  spaced");
      expect(result.code).toContain("var a =  1;");
    });

    it("keeps conditional comments", async () => {
      const html = "<!--[if IE]><div>old</div><![endif]--><div>x</div>";
      const result = await minify.format(html, "html");
      expect(result.success).toBe(true);
      expect(result.code).toContain("[if IE]");
    });
  });

  describe("JavaScript / TypeScript", () => {
    it("removes comments while preserving newlines (ASI-safe)", async () => {
      const code = "// header\nconst x = 1; /* mid */\nconst y = 2;";
      const result = await minify.format(code, "javascript");
      expect(result.success).toBe(true);
      expect(result.code).not.toContain("// header");
      expect(result.code).not.toContain("/* mid */");
      expect(result.code).toContain("\n");
    });

    it("does not touch strings or regex literals", async () => {
      const code = "const a = '// not a comment';\nconst r = /abc/gi;";
      const result = await minify.format(code, "javascript");
      expect(result.success).toBe(true);
      expect(result.code).toContain("// not a comment");
      expect(result.code).toContain("/abc/gi");
    });
  });

  describe("routing", () => {
    it("refuses unsupported languages", async () => {
      const result = await minify.format("x = 1", "ruby");
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not supported/);
    });
  });
});