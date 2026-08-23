/**
 * Type definitions shared across content script modules
 */

export interface LanguagePattern {
  lang: string;
  regex: RegExp;
  weight: number;
}

export type ToastType = "info" | "error" | "success" | "warning";
