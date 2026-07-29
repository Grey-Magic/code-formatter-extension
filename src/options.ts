/**
 * Options page script for Code Formatter Extension
 * Handles settings management, form interactions, and Chrome storage synchronization
 */

import type { ThemeName } from "./shared/types";

/**
 * Local settings interface for options page
 * All properties are required with defaults
 */
interface FormatterSettings {
  indentSize: number;
  quoteStyle: "single" | "double";
  theme: ThemeName;
  wrapLines: boolean;
  fontSize: string;
  lineHeight: number;
  useTabs: boolean;
  // Formatter options
  singleQuote: boolean;
  semi: boolean;
  trailingComma: "none" | "es5" | "all";
  // js-beautify options
  e4x: boolean;
  spaceInEmptyParens: boolean;
  unescapeStrings: boolean;
  keepArrayIndentation: boolean;
  // WASM formatter options
  quoteStyleWasm: "single" | "double" | "preserve";
  keywordCase: "upper" | "lower" | "preserve";
  commaPosition: "before" | "after";
  // Feature flags
  autoFormatOnType: boolean;
  formatOnPasteMinLength: number;
}

/**
 * Type for notification display types
 */
type NotificationType = "success" | "error" | "warning";

/**
 * Chrome storage result type for settings retrieval
 */
type StorageResult = Partial<FormatterSettings>;

document.addEventListener("DOMContentLoaded", function (): void {
  // DOM Elements - typed as nullable initially, will be checked
  const form: HTMLFormElement | null = document.getElementById(
    "options-form",
  ) as HTMLFormElement | null;
  const saveBtn: HTMLButtonElement | null = document.getElementById(
    "save-btn",
  ) as HTMLButtonElement | null;
  const resetBtn: HTMLButtonElement | null = document.getElementById(
    "reset-btn",
  ) as HTMLButtonElement | null;
  const notification: HTMLElement | null =
    document.getElementById("notification");

  // Form elements - typed appropriately
  const indentSize: HTMLSelectElement | null = document.getElementById(
    "indent-size",
  ) as HTMLSelectElement | null;
  const quoteStyle: HTMLSelectElement | null = document.getElementById(
    "quote-style",
  ) as HTMLSelectElement | null;
  const theme: HTMLSelectElement | null = document.getElementById(
    "theme",
  ) as HTMLSelectElement | null;
  const wrapLines: HTMLInputElement | null = document.getElementById(
    "wrap-lines",
  ) as HTMLInputElement | null;
  const fontSize: HTMLSelectElement | null = document.getElementById(
    "font-size",
  ) as HTMLSelectElement | null;
  const lineHeight: HTMLInputElement | null = document.getElementById(
    "line-height",
  ) as HTMLInputElement | null;
  const lineHeightValue: HTMLElement | null =
    document.getElementById("line-height-value");
  const singleQuote: HTMLInputElement | null = document.getElementById(
    "single-quote",
  ) as HTMLInputElement | null;
  const semi: HTMLInputElement | null = document.getElementById(
    "semi",
  ) as HTMLInputElement | null;
  const trailingComma: HTMLSelectElement | null = document.getElementById(
    "trailing-comma",
  ) as HTMLSelectElement | null;
  const autoFormatOnType: HTMLInputElement | null = document.getElementById(
    "auto-format-on-type",
  ) as HTMLInputElement | null;
  const formatOnPasteMinLength: HTMLInputElement | null =
    document.getElementById(
      "format-on-paste-min-length",
    ) as HTMLInputElement | null;
  const preferredFormatter: HTMLSelectElement | null = document.getElementById(
    "preferred-formatter",
  ) as HTMLSelectElement | null;

  // js-beautify options
  const e4x: HTMLInputElement | null = document.getElementById(
    "e4x",
  ) as HTMLInputElement | null;
  const spaceInEmptyParens: HTMLInputElement | null = document.getElementById(
    "space-in-empty-parens",
  ) as HTMLInputElement | null;
  const unescapeStrings: HTMLInputElement | null = document.getElementById(
    "unescape-strings",
  ) as HTMLInputElement | null;
  const keepArrayIndentation: HTMLInputElement | null = document.getElementById(
    "keep-array-indentation",
  ) as HTMLInputElement | null;

  // WASM formatter options
  const quoteStyleWasm: HTMLSelectElement | null = document.getElementById(
    "quote-style-wasm",
  ) as HTMLSelectElement | null;
  const keywordCase: HTMLSelectElement | null = document.getElementById(
    "keyword-case",
  ) as HTMLSelectElement | null;
  const commaPosition: HTMLSelectElement | null = document.getElementById(
    "comma-position",
  ) as HTMLSelectElement | null;

  // Validate that all required elements exist
  if (
    !form ||
    !saveBtn ||
    !resetBtn ||
    !notification ||
    !indentSize ||
    !quoteStyle ||
    !theme ||
    !wrapLines ||
    !fontSize ||
    !lineHeight ||
    !lineHeightValue ||
    !singleQuote ||
    !semi ||
    !trailingComma ||
    !autoFormatOnType ||
    !formatOnPasteMinLength ||
    !e4x ||
    !spaceInEmptyParens ||
    !unescapeStrings ||
    !keepArrayIndentation ||
    !quoteStyleWasm ||
    !keywordCase ||
    !commaPosition
  ) {
    console.error("[Code Formatter] Required DOM elements not found");
    return;
  }

  // Default settings
  const defaultSettings: FormatterSettings = {
    indentSize: 2,
    quoteStyle: "single",
    theme: "one-dark-pro",
    wrapLines: false,
    fontSize: "14",
    lineHeight: 1.6,
    useTabs: false,
    singleQuote: true,
    semi: true,
    trailingComma: "es5",
    autoFormatOnType: false,
    formatOnPasteMinLength: 5,
    // js-beautify options
    e4x: false,
    spaceInEmptyParens: false,
    unescapeStrings: false,
    keepArrayIndentation: false,
    // WASM formatter options
    quoteStyleWasm: "preserve",
    keywordCase: "preserve",
    commaPosition: "before",
  };

  // Theme management
  document.documentElement.setAttribute("data-theme", "dark");

  /**
   * Displays a notification message with icon
   * @param message - The message to display
   * @param type - The type of notification (success, error, warning)
   * @param duration - How long to show the notification in milliseconds
   */
  function showNotification(
    message: string,
    type: NotificationType = "success",
    duration: number = 3000,
  ): void {
    notification!.textContent = message;
    notification!.className = `notification notification-${type}`;

    // Set icon based on type
    const icon: HTMLElement = document.createElement("i");
    switch (type) {
      case "success":
        icon.className = "fas fa-check-circle";
        break;
      case "error":
        icon.className = "fas fa-exclamation-circle";
        break;
      case "warning":
        icon.className = "fas fa-exclamation-triangle";
        break;
    }

    notification!.textContent = "";
    notification!.appendChild(icon);
    notification!.appendChild(document.createTextNode(message));

    notification!.classList.add("show");

    setTimeout((): void => {
      notification!.classList.remove("show");
    }, duration);
  }

  /**
   * Synchronizes the line height slider and display value
   */
  function syncLineHeightElements(): void {
    const value: string = lineHeight!.value;
    lineHeightValue!.textContent = value;
  }

  // Line height slider event listeners
  lineHeight.addEventListener("input", syncLineHeightElements);

  /**
   * Loads saved settings from Chrome storage
   */
  function loadSettings(): void {
    const storageKeys: Array<keyof FormatterSettings> = [
      "indentSize",
      "quoteStyle",
      "theme",
      "wrapLines",
      "fontSize",
      "lineHeight",
      "singleQuote",
      "semi",
      "trailingComma",
      "autoFormatOnType",
      "formatOnPasteMinLength",
      // js-beautify options
      "e4x",
      "spaceInEmptyParens",
      "unescapeStrings",
      "keepArrayIndentation",
      // WASM formatter options
      "quoteStyleWasm",
      "keywordCase",
      "commaPosition",
      // Formatter selection
      "preferredFormatter",
    ];

    chrome.storage.sync.get(
      storageKeys,
      function (result: StorageResult): void {
        if (chrome.runtime.lastError) {
          console.warn(
            "[Code Formatter] Storage load error:",
            chrome.runtime.lastError.message,
          );
          showNotification("Failed to load settings", "error");
          return;
        }

        // Apply loaded settings or defaults with proper type handling
        indentSize!.value = String(
          result.indentSize ?? defaultSettings.indentSize,
        );
        quoteStyle!.value = result.quoteStyle || defaultSettings.quoteStyle;
        theme!.value = result.theme || defaultSettings.theme;
        wrapLines!.checked =
          result.wrapLines !== undefined
            ? result.wrapLines
            : defaultSettings.wrapLines;
        fontSize!.value = result.fontSize || defaultSettings.fontSize;
        lineHeight!.value = String(
          result.lineHeight ?? defaultSettings.lineHeight,
        );
        singleQuote!.checked =
          result.singleQuote !== undefined
            ? result.singleQuote
            : defaultSettings.singleQuote;
        semi!.checked =
          result.semi !== undefined ? result.semi : defaultSettings.semi;
        trailingComma!.value =
          result.trailingComma || defaultSettings.trailingComma;
        autoFormatOnType!.checked =
          result.autoFormatOnType !== undefined
            ? result.autoFormatOnType
            : defaultSettings.autoFormatOnType;
        formatOnPasteMinLength!.value = String(
          result.formatOnPasteMinLength ??
            defaultSettings.formatOnPasteMinLength,
        );

        // js-beautify options
        e4x!.checked =
          result.e4x !== undefined ? result.e4x : defaultSettings.e4x;
        spaceInEmptyParens!.checked =
          result.spaceInEmptyParens !== undefined
            ? result.spaceInEmptyParens
            : defaultSettings.spaceInEmptyParens;
        unescapeStrings!.checked =
          result.unescapeStrings !== undefined
            ? result.unescapeStrings
            : defaultSettings.unescapeStrings;
        keepArrayIndentation!.checked =
          result.keepArrayIndentation !== undefined
            ? result.keepArrayIndentation
            : defaultSettings.keepArrayIndentation;

        // WASM formatter options
        quoteStyleWasm!.value =
          result.quoteStyleWasm || defaultSettings.quoteStyleWasm;
        keywordCase!.value = result.keywordCase || defaultSettings.keywordCase;
        commaPosition!.value =
          result.commaPosition || defaultSettings.commaPosition;

        // Formatter selection
        preferredFormatter!.value =
          result.preferredFormatter ||
          (defaultSettings.preferredFormatter as string);

        syncLineHeightElements();

        showNotification("Settings loaded successfully", "success", 2000);
      },
    );
  }

  // Event listeners for real-time preview updates

  /**
   * Validates and saves settings to Chrome storage
   * @param e - The click event
   */
  saveBtn.addEventListener("click", function (e: MouseEvent): void {
    e.preventDefault();

    const lineHeightValueNum: number = parseFloat(lineHeight.value);
    if (
      isNaN(lineHeightValueNum) ||
      lineHeightValueNum < 1.0 ||
      lineHeightValueNum > 3.0
    ) {
      showNotification("Line height must be between 1.0 and 3.0", "error");
      lineHeight.focus();
      return;
    }

    const formatOnPasteMinLengthNum: number = parseInt(
      formatOnPasteMinLength.value,
      10,
    );
    if (
      isNaN(formatOnPasteMinLengthNum) ||
      formatOnPasteMinLengthNum < 1 ||
      formatOnPasteMinLengthNum > 50
    ) {
      showNotification(
        "Format on paste minimum length must be between 1 and 50",
        "error",
      );
      formatOnPasteMinLength.focus();
      return;
    }

    // Validate fontSize is a valid number
    const fontSizeNum: number = parseInt(fontSize.value, 10);
    if (isNaN(fontSizeNum) || fontSizeNum < 8 || fontSizeNum > 32) {
      showNotification("Font size must be between 8 and 32", "error");
      fontSize.focus();
      return;
    }

    const settings: FormatterSettings = {
      indentSize: parseInt(indentSize.value, 10) || defaultSettings.indentSize,
      quoteStyle:
        quoteStyle.value === "single" || quoteStyle.value === "double"
          ? quoteStyle.value
          : defaultSettings.quoteStyle,
      theme: [
        "one-dark-pro",
        "dracula",
        "nord",
        "monokai",
        "material",
        "github-dark",
        "github-light",
        "solarized-dark",
        "solarized-light",
        "tokyo-night",
      ].includes(theme.value)
        ? (theme.value as ThemeName)
        : defaultSettings.theme,
      wrapLines: wrapLines.checked,
      fontSize: fontSize.value,
      lineHeight: lineHeightValueNum,
      // Note: useTabs has no UI control in options page
      // Default to false (spaces) as that's the more common convention
      useTabs: false,
      singleQuote: singleQuote.checked,
      semi: semi.checked,
      trailingComma:
        trailingComma.value === "none" ||
        trailingComma.value === "es5" ||
        trailingComma.value === "all"
          ? trailingComma.value
          : defaultSettings.trailingComma,
      autoFormatOnType: autoFormatOnType.checked,
      formatOnPasteMinLength: formatOnPasteMinLengthNum,
      // js-beautify options
      e4x: e4x.checked,
      spaceInEmptyParens: spaceInEmptyParens.checked,
      unescapeStrings: unescapeStrings.checked,
      keepArrayIndentation: keepArrayIndentation.checked,
      // WASM formatter options
      quoteStyleWasm:
        quoteStyleWasm.value === "single" ||
        quoteStyleWasm.value === "double" ||
        quoteStyleWasm.value === "preserve"
          ? quoteStyleWasm.value
          : defaultSettings.quoteStyleWasm,
      keywordCase:
        keywordCase.value === "upper" ||
        keywordCase.value === "lower" ||
        keywordCase.value === "preserve"
          ? keywordCase.value
          : defaultSettings.keywordCase,
      commaPosition:
        commaPosition.value === "before" || commaPosition.value === "after"
          ? commaPosition.value
          : defaultSettings.commaPosition,
      preferredFormatter:
        preferredFormatter.value === "prettier" ||
        preferredFormatter.value === "js-beautify" ||
        preferredFormatter.value === "biome"
          ? preferredFormatter.value
          : "prettier",
    };

    chrome.storage.sync.set(settings, function (): void {
      if (chrome.runtime.lastError) {
        console.warn(
          "[Code Formatter] Storage save error:",
          chrome.runtime.lastError.message,
        );
        showNotification("Failed to save settings", "error");
        return;
      }

      showNotification("Settings saved successfully!", "success");
    });
  });

  /**
   * Resets all settings to default values
   * @param e - The click event
   */
  resetBtn.addEventListener("click", function (e: MouseEvent): void {
    e.preventDefault();

    if (!confirm("Are you sure you want to reset all settings to defaults?")) {
      return;
    }

    indentSize.value = String(defaultSettings.indentSize);
    quoteStyle.value = defaultSettings.quoteStyle;
    theme.value = defaultSettings.theme;
    wrapLines.checked = defaultSettings.wrapLines;
    fontSize.value = defaultSettings.fontSize;
    lineHeight.value = String(defaultSettings.lineHeight);
    singleQuote.checked = defaultSettings.singleQuote;
    semi.checked = defaultSettings.semi;
    trailingComma.value = defaultSettings.trailingComma;
    autoFormatOnType.checked = defaultSettings.autoFormatOnType;
    formatOnPasteMinLength.value = String(
      defaultSettings.formatOnPasteMinLength,
    );

    // js-beautify options
    e4x.checked = defaultSettings.e4x;
    spaceInEmptyParens.checked = defaultSettings.spaceInEmptyParens;
    unescapeStrings.checked = defaultSettings.unescapeStrings;
    keepArrayIndentation.checked = defaultSettings.keepArrayIndentation;

    // WASM formatter options
    quoteStyleWasm.value = defaultSettings.quoteStyleWasm;
    keywordCase.value = defaultSettings.keywordCase;
    commaPosition.value = defaultSettings.commaPosition;

    syncLineHeightElements();

    chrome.storage.sync.set(defaultSettings, function (): void {
      if (chrome.runtime.lastError) {
        console.warn(
          "[Code Formatter] Storage reset error:",
          chrome.runtime.lastError.message,
        );
        return;
      }

      showNotification("Settings reset to defaults", "success");
    });
  });

  // Initialize
  loadSettings();

  /**
   * Handles keyboard shortcuts
   * Ctrl+S / Cmd+S - Save settings
   * Escape - Focus reset button (when not in input)
   * @param e - The keyboard event
   */
  document.addEventListener("keydown", function (e: KeyboardEvent): void {
    // Save shortcut: Ctrl+S or Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveBtn.click();
    }

    // Escape key focus reset button (when not in input field)
    if (
      e.key === "Escape" &&
      document.activeElement &&
      document.activeElement.tagName !== "INPUT" &&
      document.activeElement.tagName !== "SELECT" &&
      document.activeElement.tagName !== "TEXTAREA"
    ) {
      resetBtn.focus();
    }
  });

  // Accessibility improvements - add focus indicators to form controls
  const formControls: Array<HTMLSelectElement | HTMLInputElement> = [
    indentSize,
    quoteStyle,
    theme,
    wrapLines,
    fontSize,
    trailingComma,
    formatOnPasteMinLength,
  ];

  formControls.forEach(
    (control: HTMLSelectElement | HTMLInputElement): void => {
      control.addEventListener(
        "focus",
        function (this: HTMLSelectElement | HTMLInputElement): void {
          if (this.parentElement) {
            this.parentElement.style.borderLeft =
              "3px solid var(--primary-color)";
            this.parentElement.style.paddingLeft = "0.75rem";
          }
        },
      );

      control.addEventListener(
        "blur",
        function (this: HTMLSelectElement | HTMLInputElement): void {
          if (this.parentElement) {
            this.parentElement.style.borderLeft = "";
            this.parentElement.style.paddingLeft = "";
          }
        },
      );
    },
  );
});
