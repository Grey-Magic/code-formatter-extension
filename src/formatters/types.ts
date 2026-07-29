export interface FormatterSettings {
  indentSize: number;
  useTabs: boolean;
  singleQuote?: boolean;
  semi?: boolean;
  trailingComma?: "none" | "es5" | "all";
  e4x?: boolean;
  spaceInEmptyParens?: boolean;
  unescapeStrings?: boolean;
  keepArrayIndentation?: boolean;
  quoteStyle?: "single" | "double" | "preserve";
  keywordCase?: "upper" | "lower" | "preserve";
  commaPosition?: "before" | "after";
  alignEntries?: boolean;
  alignComments?: boolean;
  indentTables?: boolean;
  autoFormatOnType?: boolean;
  formatOnPasteMinLength?: number;
  preferredFormatter?: "prettier" | "js-beautify" | "biome";
}

export interface LanguageDefaults {
  indentSize: number;
  useTabs: boolean;
  singleQuote?: boolean;
  semi?: boolean;
}

export interface FormatResult {
  success: boolean;
  code: string;
  error?: string;
}

export interface FormatterCapabilities {
  isFormatter: boolean;
  isOpinionated: boolean;
  tolerant: boolean;
}

export interface FormatterMetadata {
  id: string;
  name: string;
  description: string;
  languages: string[];
  capabilities: FormatterCapabilities;
}

export interface IFormatter {
  readonly metadata: FormatterMetadata;
  format(
    code: string,
    language: string,
    settings?: FormatterSettings,
  ): Promise<FormatResult>;
  isAvailable(): boolean;
}

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  rs: "rust",
  golang: "go",
  yml: "yaml",
};

export function normalizeLanguage(language: string): string {
  return LANGUAGE_ALIASES[language.toLowerCase()] || language.toLowerCase();
}
