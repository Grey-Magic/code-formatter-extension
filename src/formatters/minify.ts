/**
 * Safe minification strategies.
 *
 * Unlike the formatters, these transformations must never change program
 * semantics, so each language gets a conservative treatment:
 * - JSON: exact re-serialization
 * - CSS/SCSS/LESS: comment removal + whitespace collapsing outside strings
 *   (spaces required by calc() are preserved since they are never stripped)
 * - HTML/XML: comment removal + whitespace collapsing between markup,
 *   with script/style/pre/textarea contents left verbatim
 * - JS/TS: comments stripped only; newlines preserved so automatic
 *   semicolon insertion semantics cannot change
 */

import type {
  IFormatter,
  FormatterMetadata,
  FormatResult,
  FormatterSettings,
} from "./types";
import { normalizeLanguage } from "./types";
import { scanSegments, stripComments } from "../shared/code-scan";

export const MINIFY_LANGUAGES = [
  "json",
  "css",
  "scss",
  "less",
  "html",
  "xml",
  "javascript",
  "typescript",
] as const;

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

function minifyJson(code: string): FormatResult {
  try {
    return { success: true, code: JSON.stringify(JSON.parse(code)) };
  } catch (error) {
    return {
      success: false,
      code,
      error: error instanceof Error ? error.message : "Invalid JSON",
    };
  }
}

// ---------------------------------------------------------------------------
// CSS family
// ---------------------------------------------------------------------------

function minifyCss(code: string): FormatResult {
  try {
    const segments = scanSegments(code, { regexLiterals: false });
    const chunks: string[] = [];
    let cursor = 0;

    for (const seg of segments) {
      if (seg.type === "code") continue;
      chunks.push(code.slice(cursor, seg.start).replace(/\s+/g, " "));
      if (seg.type === "string") chunks.push(code.slice(seg.start, seg.end));
      cursor = seg.end;
    }
    chunks.push(code.slice(cursor).replace(/\s+/g, " "));

    let out = chunks.join("");
    out = out.replace(/\s*([{};,>~])\s*/g, "$1");
    out = out.replace(/;}/g, "}");

    return { success: true, code: out.trim() };
  } catch (error) {
    return {
      success: false,
      code,
      error: error instanceof Error ? error.message : "CSS minification failed",
    };
  }
}

// ---------------------------------------------------------------------------
// HTML/XML
// ---------------------------------------------------------------------------

const PRESERVED_HTML_TAGS = ["script", "style", "pre", "textarea"];
const CLOSE_TAG_RE = /<\/(script|style|pre|textarea)\s*>/gi;

interface HtmlChunk {
  text: string;
  preserve: boolean;
}

function splitHtmlChunks(code: string): HtmlChunk[] {
  const chunks: HtmlChunk[] = [];
  const openTag = /<(script|style|pre|textarea)\b[^>]*>/gi;

  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = openTag.exec(code)) !== null) {
    const tagName = match[1].toLowerCase();
    chunks.push({ text: code.slice(cursor, match.index), preserve: false });

    CLOSE_TAG_RE.lastIndex = match.index + match[0].length;
    const closeMatch = CLOSE_TAG_RE.exec(code);
    const end = closeMatch ? closeMatch.index + closeMatch[0].length : code.length;

    chunks.push({ text: code.slice(match.index, end), preserve: true });
    cursor = end;
    openTag.lastIndex = end;
  }

  chunks.push({ text: code.slice(cursor), preserve: false });
  return chunks;
}

function minifyHtml(code: string): FormatResult {
  try {
    let out = "";
    for (const chunk of splitHtmlChunks(code)) {
      if (chunk.preserve) {
        out += chunk.text;
        continue;
      }

      // Remove comments except conditional comments (<!--[if ...]>).
      // Collapse all whitespace runs to a single space: rendering-neutral
      // everywhere outside pre/textarea/script/style (preserved verbatim).
      out += chunk.text
        .replace(/<!--(?!\[if)[\s\S]*?-->/g, "")
        .replace(/\s+/g, " ");
    }
    return { success: true, code: out.trim() };
  } catch (error) {
    return {
      success: false,
      code,
      error: error instanceof Error ? error.message : "HTML minification failed",
    };
  }
}

// ---------------------------------------------------------------------------
// JavaScript / TypeScript
// ---------------------------------------------------------------------------

function minifyJs(code: string): FormatResult {
  try {
    let out = stripComments(code);
    out = out
      .replace(/[ \t]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n");
    return { success: true, code: out.trim() };
  } catch (error) {
    return {
      success: false,
      code,
      error:
        error instanceof Error ? error.message : "JavaScript minification failed",
    };
  }
}

// ---------------------------------------------------------------------------
// Formatter interface
// ---------------------------------------------------------------------------

/**
 * Formatter strategy that compresses instead of beautifying. It is held by
 * the registry but intentionally NOT registered into the language map, so it
 * only runs when settings.minify is enabled.
 */
export class MinifyFormatter implements IFormatter {
  readonly metadata: FormatterMetadata = {
    id: "minify",
    name: "Minifier",
    description: "Safe minification (comments/whitespace removal, no mangling)",
    languages: [...MINIFY_LANGUAGES],
    capabilities: {
      isFormatter: true,
      isOpinionated: false,
      tolerant: false,
    },
  };

  supports(language: string): boolean {
    return (MINIFY_LANGUAGES as readonly string[]).includes(
      normalizeLanguage(language),
    );
  }

  async format(
    code: string,
    language: string,
    _settings?: FormatterSettings,
  ): Promise<FormatResult> {
    switch (normalizeLanguage(language)) {
      case "json":
        return minifyJson(code);
      case "css":
      case "scss":
      case "less":
        return minifyCss(code);
      case "html":
      case "xml":
        return minifyHtml(code);
      case "javascript":
      case "typescript":
        return minifyJs(code);
      default:
        return {
          success: false,
          code,
          error: `Minification not supported for language: ${language}`,
        };
    }
  }

  isAvailable(): boolean {
    return true;
  }
}
