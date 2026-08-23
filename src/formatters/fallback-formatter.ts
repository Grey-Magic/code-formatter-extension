import type {
  IFormatter,
  FormatterMetadata,
  FormatResult,
  FormatterSettings,
} from "./types";
import { scanSegments } from "../shared/code-scan";

export class FallbackFormatter implements IFormatter {
  readonly metadata: FormatterMetadata = {
    id: "fallback",
    name: "Fallback Formatter",
    description:
      "Basic indentation and normalization for unsupported languages",
    languages: ["rust", "ruby", "lua", "zig", "dart"],
    capabilities: {
      isFormatter: false,
      isOpinionated: false,
      tolerant: true,
    },
  };

  async format(
    code: string,
    language: string,
    settings?: FormatterSettings,
  ): Promise<FormatResult> {
    try {
      const indentSize = settings?.indentSize ?? 2;
      const indentChar = settings?.useTabs ? "\t" : " ";
      const indent = indentChar.repeat(indentSize);

      switch (language.toLowerCase()) {
        case "rust":
          return this.formatRust(code, indent);
        case "ruby":
          return this.formatRuby(code, indent);
        case "lua":
          return this.formatLua(code, indent);
        case "zig":
          return this.formatZig(code, indent);
        case "dart":
          return this.formatDart(code, indent);
        default:
          return this.formatGeneric(code, indent);
      }
    } catch (error) {
      return {
        success: false,
        code,
        error:
          error instanceof Error ? error.message : "Fallback formatting failed",
      };
    }
  }

  private formatWithPattern(
    code: string,
    indent: string,
    replacements: Array<[RegExp, string]>,
  ): FormatResult {
    const segments = scanSegments(code, { regexLiterals: false });
    const codeRanges: Array<[number, number]> = [];

    for (const seg of segments) {
      if (seg.type === "code") {
        codeRanges.push([seg.start, seg.end]);
      }
    }

    if (codeRanges.length === 0) {
      codeRanges.push([0, code.length]);
    }

    let result = "";
    let cursor = 0;

    for (const [start, end] of codeRanges) {
      result += code.slice(cursor, start);
      let segment = code.slice(start, end);
      segment = segment.replace(/\r\n/g, "\n");
      for (const [pattern, replacement] of replacements) {
        segment = segment.replace(pattern, replacement);
      }
      result += segment;
      cursor = end;
    }
    result += code.slice(cursor);

    const lines = result.split("\n");
    const formatted = this.formatLinesWithIndentation(lines, indent)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return { success: true, code: formatted };
  }

  private formatRust(code: string, indent: string): FormatResult {
    return this.formatWithPattern(code, indent, [
      [/\s*\{\s*/g, " {\n"],
      [/\s*\}\s*/g, "\n}\n"],
      [/;\s*/g, ";\n"],
    ]);
  }

  private formatRuby(code: string, indent: string): FormatResult {
    return this.formatWithPattern(code, indent, [
      [/\s*end\s*/g, "\nend\n"],
    ]);
  }

  private formatLua(code: string, indent: string): FormatResult {
    return this.formatWithPattern(code, indent, [
      [/\s*then\s*/g, " then\n"],
      [/\s*end\s*/g, "\nend\n"],
    ]);
  }

  private formatZig(code: string, indent: string): FormatResult {
    return this.formatWithPattern(code, indent, [
      [/\s*\{\s*/g, " {\n"],
      [/\s*\}\s*/g, "\n}\n"],
    ]);
  }

  private formatDart(code: string, indent: string): FormatResult {
    return this.formatWithPattern(code, indent, [
      [/\s*\{\s*/g, " {\n"],
      [/\s*\}\s*/g, "\n}\n"],
      [/;\s*/g, ";\n"],
    ]);
  }

  private formatGeneric(code: string, indent: string): FormatResult {
    const lines = code.replace(/\r\n/g, "\n").split("\n");
    const formatted = this.formatLinesWithIndentation(lines, indent)
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return { success: true, code: formatted };
  }

  private formatLinesWithIndentation(
    lines: string[],
    indent: string,
  ): string[] {
    let indentLevel = 0;

    return lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";

      let openCount = 0;
      let closeCount = 0;
      for (let i = 0; i < trimmed.length; i++) {
        const ch = trimmed.charCodeAt(i);
        if (ch === 123 || ch === 91 || ch === 40) openCount++;
        else if (ch === 125 || ch === 93 || ch === 41) closeCount++;
      }

      let currentIndent = indentLevel;
      const firstChar = trimmed.charCodeAt(0);
      if (firstChar === 125 || firstChar === 93 || firstChar === 41) {
        currentIndent = Math.max(0, indentLevel - 1);
      }

      indentLevel += openCount - closeCount;
      indentLevel = Math.max(0, indentLevel);

      return indent.repeat(currentIndent) + trimmed;
    });
  }

  isAvailable(): boolean {
    return true;
  }
}
