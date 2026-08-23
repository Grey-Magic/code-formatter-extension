import type {
  IFormatter,
  FormatterMetadata,
  FormatResult,
  FormatterSettings,
} from "./types";
import { loadWasmFormatter, isWasmSupported } from "./wasm-loader";

// biome-ignore lint/suspicious/noExplicitAny: WASM module shape varies per formatter
type WasmModule = any;

abstract class WasmFormatterBase implements IFormatter {
  abstract readonly metadata: FormatterMetadata;
  protected abstract readonly jsFile: string;
  protected abstract readonly wasmFile: string;
  protected abstract readonly langLabel: string;

  protected abstract formatWasm(
    mod: WasmModule,
    code: string,
    language: string,
    settings?: FormatterSettings,
  ): string;

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
          error: `WebAssembly is not supported in this browser. ${this.langLabel} formatting requires WASM.`,
        };
      }

      const mod = await loadWasmFormatter(this.jsFile, this.wasmFile);
      const formatted = this.formatWasm(mod, code, language, settings);
      return { success: true, code: formatted };
    } catch (error) {
      return {
        success: false,
        code,
        error:
          error instanceof Error
            ? error.message
            : `${this.langLabel} formatting failed. Make sure WASM is enabled.`,
      };
    }
  }

  isAvailable(): boolean {
    return isWasmSupported();
  }
}

export class RuffFormatter extends WasmFormatterBase {
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
  protected readonly jsFile = "ruff_fmt_web.js";
  protected readonly wasmFile = "ruff_fmt_bg.wasm";
  protected readonly langLabel = "Python";

  protected formatWasm(
    mod: WasmModule,
    code: string,
    _language: string,
    settings?: FormatterSettings,
  ): string {
    return mod.format(code, null, {
      indent_style: settings?.useTabs ? "tab" : "space",
      indent_width: settings?.indentSize ?? 4,
      quote_style: settings?.quoteStyle ?? "preserve",
    });
  }
}

export class GofmtFormatter extends WasmFormatterBase {
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
  protected readonly jsFile = "gofmt_web.js";
  protected readonly wasmFile = "gofmt.wasm";
  protected readonly langLabel = "Go";

  protected formatWasm(mod: WasmModule, code: string): string {
    return mod.format(code);
  }
}

export class SqlFormatter extends WasmFormatterBase {
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
  protected readonly jsFile = "sql_fmt_web.js";
  protected readonly wasmFile = "sql_fmt_bg.wasm";
  protected readonly langLabel = "SQL";

  protected formatWasm(
    mod: WasmModule,
    code: string,
    _language: string,
    settings?: FormatterSettings,
  ): string {
    return mod.format(code, {
      keyword_case: settings?.keywordCase ?? "preserve",
      indent_width: settings?.indentSize ?? 2,
    });
  }
}

export class YamlFormatter extends WasmFormatterBase {
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
  protected readonly jsFile = "yamlfmt_web.js";
  protected readonly wasmFile = "yamlfmt_bg.wasm";
  protected readonly langLabel = "YAML";

  protected formatWasm(
    mod: WasmModule,
    code: string,
    _language: string,
    settings?: FormatterSettings,
  ): string {
    return mod.format(code, {
      indent: settings?.indentSize ?? 2,
    });
  }
}

const BIOME_EXTENSION_MAP: Record<string, string> = {
  javascript: "index.js",
  typescript: "index.ts",
  json: "index.json",
  css: "index.css",
};

export class BiomeFormatter extends WasmFormatterBase {
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
  protected readonly jsFile = "biome_fmt_web.js";
  protected readonly wasmFile = "biome_fmt_bg.wasm";
  protected readonly langLabel = "Biome";

  protected formatWasm(
    mod: WasmModule,
    code: string,
    language: string,
    settings?: FormatterSettings,
  ): string {
    const filename = BIOME_EXTENSION_MAP[language] || "index.js";
    return mod.format(code, filename, {
      indentStyle: settings?.useTabs ? "tab" : "space",
      indentWidth: settings?.indentSize ?? 2,
      lineWidth: settings?.lineWidth ?? 80,
    });
  }
}

export class TomlFormatter extends WasmFormatterBase {
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
  protected readonly jsFile = "taplo_fmt_web.js";
  protected readonly wasmFile = "taplo_fmt_bg.wasm";
  protected readonly langLabel = "TOML";

  protected formatWasm(
    mod: WasmModule,
    code: string,
    _language: string,
    settings?: FormatterSettings,
  ): string {
    return mod.format(code, {
      align_entries: settings?.alignEntries ?? false,
      align_comments: settings?.alignComments ?? false,
      indent_tables: settings?.indentTables ?? false,
    });
  }
}
