import type {
  IFormatter,
  FormatterMetadata,
  FormatResult,
  FormatterSettings,
} from "./types";
import { loadWasmFormatter, isWasmSupported } from "./wasm-loader";

// Python formatter using Ruff (Rust-based, very fast)
export class RuffFormatter implements IFormatter {
  readonly metadata: FormatterMetadata = {
    id: "ruff",
    name: "Ruff",
    description: "Python formatter (Rust-based, extremely fast)",
    languages: ["python"],
    capabilities: {
      isFormatter: true,
      isOpinionated: true,
      tolerant: false,
    },
  };

  async format(
    code: string,
    _language: string,
    settings?: FormatterSettings,
  ): Promise<FormatResult> {
    try {
      // Check WASM support first
      if (!isWasmSupported()) {
        return {
          success: false,
          code,
          error:
            "WebAssembly is not supported in this browser. Python formatting requires WASM.",
        };
      }

      const ruff = await loadWasmFormatter(
        "ruff_fmt_web.js",
        "ruff_fmt_bg.wasm",
      );

      const formatted = ruff.format(code, null, {
        indent_style: settings?.useTabs ? "tab" : "space",
        indent_width: settings?.indentSize ?? 4,
        quote_style: settings?.quoteStyle ?? "preserve",
      });

      return { success: true, code: formatted };
    } catch (error) {
      return {
        success: false,
        code,
        error:
          error instanceof Error
            ? error.message
            : "Python formatting failed. Make sure WASM is enabled.",
      };
    }
  }

  isAvailable(): boolean {
    return isWasmSupported();
  }
}

// Go formatter
export class GofmtFormatter implements IFormatter {
  readonly metadata: FormatterMetadata = {
    id: "gofmt",
    name: "gofmt",
    description: "Go language formatter (standard)",
    languages: ["go"],
    capabilities: {
      isFormatter: true,
      isOpinionated: true,
      tolerant: false,
    },
  };

  async format(code: string, _language: string): Promise<FormatResult> {
    try {
      if (!isWasmSupported()) {
        return {
          success: false,
          code,
          error:
            "WebAssembly is not supported in this browser. Go formatting requires WASM.",
        };
      }

      const gofmt = await loadWasmFormatter("gofmt_web.js", "gofmt.wasm");

      const formatted = gofmt.format(code);
      return { success: true, code: formatted };
    } catch (error) {
      return {
        success: false,
        code,
        error:
          error instanceof Error
            ? error.message
            : "Go formatting failed. Make sure WASM is enabled.",
      };
    }
  }

  isAvailable(): boolean {
    return isWasmSupported();
  }
}

// SQL formatter
export class SqlFormatter implements IFormatter {
  readonly metadata: FormatterMetadata = {
    id: "sql-formatter",
    name: "SQL Formatter",
    description: "SQL code formatter",
    languages: ["sql"],
    capabilities: {
      isFormatter: true,
      isOpinionated: true,
      tolerant: true,
    },
  };

  async format(
    code: string,
    _language: string,
    settings?: FormatterSettings,
  ): Promise<FormatResult> {
    try {
      if (!isWasmSupported()) {
        return {
          success: false,
          code,
          error:
            "WebAssembly is not supported in this browser. SQL formatting requires WASM.",
        };
      }

      const sqlfmt = await loadWasmFormatter(
        "sql_fmt_web.js",
        "sql_fmt_bg.wasm",
      );

      const formatted = sqlfmt.format(code, {
        keyword_case: settings?.keywordCase ?? "preserve",
        indent_width: settings?.indentSize ?? 2,
      });
      return { success: true, code: formatted };
    } catch (error) {
      return {
        success: false,
        code,
        error:
          error instanceof Error
            ? error.message
            : "SQL formatting failed. Make sure WASM is enabled.",
      };
    }
  }

  isAvailable(): boolean {
    return isWasmSupported();
  }
}

// YAML formatter
export class YamlFormatter implements IFormatter {
  readonly metadata: FormatterMetadata = {
    id: "yaml-formatter",
    name: "YAML Formatter",
    description: "YAML code formatter",
    languages: ["yaml"],
    capabilities: {
      isFormatter: true,
      isOpinionated: true,
      tolerant: true,
    },
  };

  async format(
    code: string,
    _language: string,
    settings?: FormatterSettings,
  ): Promise<FormatResult> {
    try {
      if (!isWasmSupported()) {
        return {
          success: false,
          code,
          error:
            "WebAssembly is not supported in this browser. YAML formatting requires WASM.",
        };
      }

      const yamlfmt = await loadWasmFormatter(
        "yamlfmt_web.js",
        "yamlfmt_bg.wasm",
      );

      const formatted = yamlfmt.format(code, {
        indent: settings?.indentSize ?? 2,
      });
      return { success: true, code: formatted };
    } catch (error) {
      return {
        success: false,
        code,
        error:
          error instanceof Error
            ? error.message
            : "YAML formatting failed. Make sure WASM is enabled.",
      };
    }
  }

  isAvailable(): boolean {
    return isWasmSupported();
  }
}

// Biome formatter (JavaScript/TypeScript/JSON/CSS)
export class BiomeFormatter implements IFormatter {
  readonly metadata: FormatterMetadata = {
    id: "biome",
    name: "Biome",
    description: "Biome formatter for JavaScript, TypeScript, JSON, and CSS",
    languages: ["javascript", "typescript", "json", "css"],
    capabilities: {
      isFormatter: true,
      isOpinionated: true,
      tolerant: false,
    },
  };

  async format(
    code: string,
    language: string,
    settings?: FormatterSettings,
  ): Promise<FormatResult> {
    try {
      if (!isWasmSupported()) {
        return {
          success: false,
          code,
          error:
            "WebAssembly is not supported in this browser. Biome formatting requires WASM.",
        };
      }

      const biome = await loadWasmFormatter(
        "biome_fmt_web.js",
        "biome_fmt_bg.wasm",
      );

      // Map language to filename extension for Biome
      const extensionMap: Record<string, string> = {
        javascript: "index.js",
        typescript: "index.ts",
        json: "index.json",
        css: "index.css",
      };
      const filename = extensionMap[language] || "index.js";

      const formatted = biome.format(code, filename, {
        indentStyle: settings?.useTabs ? "tab" : "space",
        indentWidth: settings?.indentSize ?? 2,
        lineWidth: 80,
      });
      return { success: true, code: formatted };
    } catch (error) {
      return {
        success: false,
        code,
        error:
          error instanceof Error
            ? error.message
            : "Biome formatting failed. Make sure WASM is enabled.",
      };
    }
  }

  isAvailable(): boolean {
    return isWasmSupported();
  }
}

// TOML formatter
export class TomlFormatter implements IFormatter {
  readonly metadata: FormatterMetadata = {
    id: "toml-formatter",
    name: "TOML Formatter",
    description: "TOML code formatter using Taplo",
    languages: ["toml"],
    capabilities: {
      isFormatter: true,
      isOpinionated: true,
      tolerant: true,
    },
  };

  async format(
    code: string,
    _language: string,
    settings?: FormatterSettings,
  ): Promise<FormatResult> {
    try {
      if (!isWasmSupported()) {
        return {
          success: false,
          code,
          error:
            "WebAssembly is not supported in this browser. TOML formatting requires WASM.",
        };
      }

      const taplo = await loadWasmFormatter(
        "taplo_fmt_web.js",
        "taplo_fmt_bg.wasm",
      );

      const formatted = taplo.format(code, {
        align_entries: settings?.alignEntries ?? false,
        align_comments: settings?.alignComments ?? false,
        indent_tables: settings?.indentTables ?? false,
      });
      return { success: true, code: formatted };
    } catch (error) {
      return {
        success: false,
        code,
        error:
          error instanceof Error
            ? error.message
            : "TOML formatting failed. Make sure WASM is enabled.",
      };
    }
  }

  isAvailable(): boolean {
    return isWasmSupported();
  }
}
