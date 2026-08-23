/**
 * Editor diagnostics backed by @codemirror/lint.
 *
 * Provides real syntax validation for JSON (via JSON.parse with position
 * extraction) and bracket-balance checking for C-like languages using the
 * shared scanner, which skips strings/comments/templates/regexes so their
 * contents can never produce false positives.
 */

import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import type { Extension } from "@codemirror/state";
import { findUnbalancedBracket } from "../shared/code-scan";

const LINTABLE_LANGUAGES = new Set([
  "json",
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "css",
  "scss",
  "less",
  "html",
  "xml",
]);

/** Languages checked with regex-literal awareness */
const JS_FAMILY = new Set(["javascript", "typescript", "jsx", "tsx"]);

function offsetFromLineColumn(
  code: string,
  line: number,
  column: number,
): number {
  const lines = code.split("\n");
  let offset = 0;
  for (let i = 0; i < Math.min(line - 1, lines.length); i++) {
    offset += lines[i].length + 1;
  }
  return offset + Math.max(0, column - 1);
}

/** Extract a failure offset from engine-specific JSON.parse error text */
export function jsonErrorOffset(
  message: string,
  code: string,
): number {
  const posMatch = /position (\d+)/i.exec(message);
  if (posMatch) {
    const pos = parseInt(posMatch[1], 10);
    if (Number.isFinite(pos)) return Math.min(pos, Math.max(0, code.length - 1));
  }

  const lineMatch = /line (\d+)[^\d]+column (\d+)/i.exec(message);
  if (lineMatch) {
    return Math.min(
      offsetFromLineColumn(code, parseInt(lineMatch[1], 10), parseInt(lineMatch[2], 10)),
      Math.max(0, code.length - 1),
    );
  }

  return 0;
}

function jsonDiagnostics(code: string): Diagnostic[] {
  try {
    JSON.parse(code);
    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    const offset = jsonErrorOffset(message, code);
    return [
      {
        from: offset,
        to: Math.min(offset + 1, code.length),
        severity: "error",
        source: "json",
        message,
      },
    ];
  }
}

function bracketDiagnostics(code: string, language: string): Diagnostic[] {
  // HTML/XML bracket balance is too noisy (attribute values, void elements)
  if (language === "html" || language === "xml") return [];

  const mismatch = findUnbalancedBracket(code, {
    regexLiterals: JS_FAMILY.has(language),
  });
  if (!mismatch) return [];

  const message =
    mismatch.kind === "unclosed"
      ? `Unclosed "${mismatch.char}" bracket`
      : `Unexpected closing "${mismatch.char}"`;

  return [
    {
      from: Math.min(mismatch.offset, Math.max(0, code.length - 1)),
      to: Math.min(mismatch.offset + 1, code.length),
      severity: "error",
      source: "bracket-check",
      message,
    },
  ];
}

export function computeDiagnostics(code: string, language: string): Diagnostic[] {
  if (!code || !LINTABLE_LANGUAGES.has(language)) return [];

  try {
    if (language === "json") return jsonDiagnostics(code);
    return bracketDiagnostics(code, language);
  } catch {
    return [];
  }
}

export function isLintable(language: string): boolean {
  return LINTABLE_LANGUAGES.has(language);
}

/**
 * Build the CodeMirror lint extensions for a language.
 * Returns an empty array for languages without diagnostics or very large
 * documents handled by the caller.
 */
export function createLintExtension(language: string): Extension[] {
  if (!isLintable(language)) return [];

  return [
    lintGutter(),
    linter(
      (view) => computeDiagnostics(view.state.doc.toString(), language),
      { delay: 500 },
    ),
  ];
}
