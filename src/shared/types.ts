/**
 * Shared type definitions across the extension
 */

/** User-configurable extension settings */
export interface ExtensionSettings {
  indentSize: number;
  quoteStyle: "single" | "double";
  theme: ThemeName;
  wrapLines: boolean;
  fontSize: string;
  lineHeight: number;
  useTabs: boolean;
  // Formatter options
  singleQuote?: boolean;
  semi?: boolean;
  trailingComma?: "none" | "es5" | "all";
  // js-beautify options
  e4x?: boolean;
  spaceInEmptyParens?: boolean;
  unescapeStrings?: boolean;
  keepArrayIndentation?: boolean;
  // WASM formatter options
  quoteStyleWasm?: "single" | "double" | "preserve";
  keywordCase?: "upper" | "lower" | "preserve";
  commaPosition?: "before" | "after";
  // Feature flags
  autoFormatOnType?: boolean;
  formatOnPasteMinLength?: number;
  // Formatter selection
  preferredFormatter?: "prettier" | "js-beautify" | "biome";
}

/** Available theme names */
export type ThemeName =
  | "one-dark-pro"
  | "dracula"
  | "nord"
  | "monokai"
  | "material"
  | "github-dark"
  | "github-light"
  | "solarized-dark"
  | "solarized-light"
  | "tokyo-night";

/** Supported language identifiers */
export type LanguageId =
  | "javascript"
  | "typescript"
  | "json"
  | "css"
  | "scss"
  | "html"
  | "xml"
  | "python"
  | "markdown"
  | "go"
  | "rust"
  | "sql"
  | "yaml"
  | "toml"
  | "ruby";

/** Messages sent between content script and background */
export interface FormatMessage {
  action: "format";
  language: string;
  code: string;
  settings?: Partial<ExtensionSettings>;
}

export interface FormatResponse {
  success: boolean;
  code?: string;
  error?: string;
}

export interface FormatSelectionMessage {
  action: "formatSelection";
  language: string;
  code: string;
}

export interface GetLanguageMessage {
  action: "getLanguage";
}

export type ExtensionMessage =
  | FormatMessage
  | FormatSelectionMessage
  | GetLanguageMessage
  | { action: string; [key: string]: unknown };

/** Notification types for toast system */
export type NotificationType = "success" | "error" | "warning" | "info";

export interface GetSupportedLanguagesResponse {
  success: boolean;
  languages: string[];
}

export interface CheckLanguageSupportResponse {
  success: boolean;
  isSupported: boolean;
}

/**
 * Union type for all possible responses from background script
 */
export type BackgroundResponse =
  | FormatResponse
  | GetSupportedLanguagesResponse
  | CheckLanguageSupportResponse
  | { success: boolean; error: string };
