/**
 * Code Formatter Extension - Background Script
 *
 * Handles code formatting requests from the content script using the new
 * formatter registry with support for Prettier and WASM-based formatters.
 * Manages extension lifecycle, context menus, and message routing.
 */

import {
  formatterRegistry,
  type FormatterSettings,
  type FormatResult,
} from "./formatters";
import type {
  ExtensionMessage,
  FormatMessage,
  FormatResponse,
  GetSupportedLanguagesResponse,
  CheckLanguageSupportResponse,
} from "./shared/types";
import { LRUMap } from "./shared/utils";
import {
  LANGUAGE_DEFAULTS,
  CONTEXT_MENU_LANGUAGE_MAP,
} from "./shared/constants";

const formatCache = new LRUMap<string, string>(50);

const MAX_CODE_SIZE = 1024 * 1024;

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<number, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 1000;
const RATE_LIMIT_MAX = 10;

chrome.tabs.onRemoved.addListener((tabId) => {
  rateLimitMap.delete(tabId);
});

/**
 * Validates the sender of a message to prevent unauthorized access
 * Only accepts messages from the extension's own pages or content scripts
 */
function validateSender(sender: chrome.runtime.MessageSender): {
  valid: boolean;
  error?: string;
} {
  if (!sender.id || sender.id === chrome.runtime.id) {
    return { valid: true };
  }

  if (sender.url) {
    return { valid: true };
  }

  return { valid: false, error: "Unknown message sender" };
}

/**
 * Check and enforce rate limiting for format requests
 * Returns true if request is allowed, false if rate limited
 */
function checkRateLimit(tabId: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(tabId);

  if (!entry || now > entry.resetTime) {
    // Reset or create new entry
    rateLimitMap.set(tabId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    // Rate limited
    console.warn(`[Code Formatter] Rate limit exceeded for tab ${tabId}`);
    return false;
  }

  // Increment counter
  entry.count++;
  return true;
}

/**
 * Validates format message parameters
 * Returns error message if invalid, null if valid
 */
function validateFormatMessage(msg: unknown): string | null {
  if (!msg || typeof msg !== "object") {
    return "Invalid message format";
  }

  const formatMsg = msg as Record<string, unknown>;

  // Validate code parameter
  if (formatMsg.code === undefined || formatMsg.code === null) {
    return "Missing required parameter: code";
  }
  if (typeof formatMsg.code !== "string") {
    return 'Parameter "code" must be a string';
  }
  if (formatMsg.code.length === 0) {
    return 'Parameter "code" cannot be empty';
  }
  if (formatMsg.code.length > MAX_CODE_SIZE) {
    return `Code size exceeds maximum limit of ${MAX_CODE_SIZE} bytes`;
  }

  // Validate language parameter
  if (formatMsg.language === undefined || formatMsg.language === null) {
    return "Missing required parameter: language";
  }
  if (typeof formatMsg.language !== "string") {
    return 'Parameter "language" must be a string';
  }
  if (formatMsg.language.length === 0) {
    return 'Parameter "language" cannot be empty';
  }
  if (!formatterRegistry.isSupported(formatMsg.language)) {
    return `Unsupported language: ${formatMsg.language}`;
  }

  // Validate settings if provided
  if (formatMsg.settings !== undefined && formatMsg.settings !== null) {
    if (typeof formatMsg.settings !== "object") {
      return 'Parameter "settings" must be an object';
    }
  }

  return null;
}

/**
 * Generate a synchronous cache key using djb2 hash
 */
function hashKey(
  code: string,
  language: string,
  settings?: FormatterSettings,
): string {
  const settingsStr = JSON.stringify(settings ?? {});
  const str = `${language}:${settingsStr}:${code}`;

  const SAMPLE_END = 8192;
  const TAIL_LEN = 2048;
  let hash = 5381;

  const end = str.length < SAMPLE_END ? str.length : SAMPLE_END;
  for (let i = 0; i < end; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }

  if (str.length > SAMPLE_END) {
    const start = str.length - TAIL_LEN;
    for (let i = start; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }
    hash = ((hash << 5) + hash + str.length) | 0;
  }

  return hash.toString(36);
}

/**
 * Convert extension settings to formatter settings
 * Merges language-specific defaults with user settings (user settings take precedence)
 */
function convertSettings(
  settings?: FormatMessage["settings"],
  language?: string,
): FormatterSettings {
  // Get language-specific defaults if available
  const langDefaults = language ? LANGUAGE_DEFAULTS[language] : undefined;

  // Parse indent size from settings
  const indentSize =
    typeof settings?.indentSize === "string"
      ? parseInt(settings.indentSize as string, 10) || 2
      : (settings?.indentSize ?? langDefaults?.indentSize ?? 2);

  // Build formatter settings with priority: user settings > language defaults > global defaults
  return {
    indentSize,
    useTabs: settings?.useTabs ?? langDefaults?.useTabs ?? false,
    singleQuote: settings?.singleQuote ?? langDefaults?.singleQuote ?? true,
    semi: settings?.semi ?? langDefaults?.semi ?? true,
    trailingComma: settings?.trailingComma ?? "es5",
    minify: settings?.minify ?? false,
    preferredFormatter:
      (settings?.preferredFormatter as
        | "prettier"
        | "js-beautify"
        | "biome") ?? "prettier",
  };
}

/**
 * Format code using the formatter registry, with caching
 */
const FORMAT_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function formatCode(
  code: string,
  language: string,
  settings?: FormatMessage["settings"],
): Promise<FormatResult> {
  if (!formatterRegistry.isSupported(language)) {
    return {
      success: false,
      code,
      error: `Language "${language}" is not supported`,
    };
  }

  const formatterSettings = convertSettings(settings, language);
  const key = hashKey(code, language, formatterSettings);
  const cached = formatCache.get(key);
  if (cached) {
    return { success: true, code: cached };
  }

  try {
    const result = await withTimeout(
      formatterRegistry.format(code, language, formatterSettings),
      FORMAT_TIMEOUT_MS,
    );

    if (result.success) {
      formatCache.set(key, result.code);
    }

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Formatting failed";
    console.error("[Code Formatter] Format error:", errorMessage);
    return {
      success: false,
      code,
      error: errorMessage,
    };
  }
}

// ============================================================================
// Message Handling
// ============================================================================

function setupMessageHandlers(): void {
  chrome.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: FormatResponse) => void,
    ): boolean => {
      // Validate sender origin to prevent unauthorized access
      const senderValidation = validateSender(sender);
      if (!senderValidation.valid) {
        console.warn(
          "[Code Formatter] Invalid message sender:",
          senderValidation.error,
        );
        sendResponse({ success: false, error: "Unauthorized message sender" });
        return true;
      }

      // Apply rate limiting for format requests
      if (message.action === "format" && sender.tab?.id) {
        if (!checkRateLimit(sender.tab.id)) {
          sendResponse({
            success: false,
            error: "Rate limit exceeded. Please try again later.",
          });
          return true;
        }
      }

      if (message.action === "format") {
        // Validate message parameters
        const validationError = validateFormatMessage(message);
        if (validationError) {
          sendResponse({ success: false, error: validationError });
          return true;
        }

        const formatMsg = message as unknown as FormatMessage;

        // Use async/await with Promise
        formatCode(formatMsg.code, formatMsg.language, formatMsg.settings)
          .then((result) => {
            if (result.success) {
              sendResponse({ success: true, code: result.code });
            } else {
              sendResponse({
                success: false,
                error: result.error || "Formatting failed",
              });
            }
          })
          .catch((error) => {
            console.error("[Code Formatter] Formatting error:", error);
            sendResponse({
              success: false,
              error:
                error instanceof Error ? error.message : "Formatting failed",
            });
          });
      } else if (message.action === "getSupportedLanguages") {
        const languages = formatterRegistry.getSupportedLanguages();
        const response: GetSupportedLanguagesResponse = {
          success: true,
          languages,
        };
        sendResponse(response);
      } else if (message.action === "checkLanguageSupport") {
        // Validate language parameter
        const msg = message as Record<string, unknown>;
        if (!msg.language || typeof msg.language !== "string") {
          sendResponse({
            success: false,
            error: "Invalid or missing language parameter",
          });
          return true;
        }

        const isSupported = formatterRegistry.isSupported(msg.language);
        const response: CheckLanguageSupportResponse = {
          success: true,
          isSupported,
        };
        sendResponse(response);
      } else {
        sendResponse({
          success: false,
          error: `Unknown action: ${message.action}`,
        });
      }

      return true;
    },
  );
}

// ============================================================================
// Context Menu
// ============================================================================

function setupContextMenu(): void {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "codeFormatter",
      title: "Format Code",
      contexts: ["page", "selection"],
    });

    chrome.contextMenus.create({
      id: "formatJS",
      parentId: "codeFormatter",
      title: "Format as JavaScript",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "formatTS",
      parentId: "codeFormatter",
      title: "Format as TypeScript",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "formatCSS",
      parentId: "codeFormatter",
      title: "Format as CSS",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "formatHTML",
      parentId: "codeFormatter",
      title: "Format as HTML",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "formatJSON",
      parentId: "codeFormatter",
      title: "Format as JSON",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "formatPython",
      parentId: "codeFormatter",
      title: "Format as Python",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "formatGo",
      parentId: "codeFormatter",
      title: "Format as Go",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "formatSQL",
      parentId: "codeFormatter",
      title: "Format as SQL",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "formatYAML",
      parentId: "codeFormatter",
      title: "Format as YAML",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "formatTOML",
      parentId: "codeFormatter",
      title: "Format as TOML",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "formatDockerfile",
      parentId: "codeFormatter",
      title: "Format as Dockerfile",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "formatMakefile",
      parentId: "codeFormatter",
      title: "Format as Makefile",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "ignoreThisSite",
      title: "Code Formatter: Ignore this site",
      contexts: ["page"],
    });
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    // Page-context action: add the current host to the user's ignore list
    // and reload the tab so the change takes effect immediately.
    if (info.menuItemId === "ignoreThisSite") {
      if (!tab?.id || !info.pageUrl) return;
      let host = "";
      try {
        host = new URL(info.pageUrl).hostname.toLowerCase();
      } catch {
        return;
      }
      if (!host) return;
      chrome.storage.sync.get(["ignoredSites"], (result) => {
        const existing = Array.isArray(result.ignoredSites)
          ? result.ignoredSites
          : [];
        if (!existing.includes(host)) {
          chrome.storage.sync.set(
            { ignoredSites: [...existing, host] },
            () => {
              if (tab.id !== undefined) {
                chrome.tabs.reload(tab.id);
              }
            },
          );
        } else if (tab.id !== undefined) {
          chrome.tabs.reload(tab.id);
        }
      });
      return;
    }

    if (!tab?.id || !info.selectionText) return;

    if (info.selectionText.length > MAX_CODE_SIZE) {
      console.warn("[Code Formatter] Selection too large to format");
      return;
    }

    const language = CONTEXT_MENU_LANGUAGE_MAP[info.menuItemId as string];
    if (!language) return;

    // Send message with error handling
    try {
      chrome.tabs.sendMessage(tab.id, {
        action: "formatSelection",
        language,
        code: info.selectionText,
      });
    } catch (error) {
      console.error("[Code Formatter] Failed to send message to tab:", error);
    }
  });
}

// ============================================================================
// Extension Lifecycle
// ============================================================================

// Track initialization state to prevent duplicate initialization
let isInitialized = false;

function initializeExtension(): void {
  // Prevent double initialization
  if (isInitialized) {
    console.log("[Code Formatter] Already initialized, skipping");
    return;
  }
  isInitialized = true;

  console.log("[Code Formatter] Extension initialized");
  console.log(
    "[Code Formatter] Supported languages:",
    formatterRegistry.getSupportedLanguages().join(", "),
  );
  setupMessageHandlers();
  setupContextMenu();
}

/**
 * Records the current extension version in local storage on install/update.
 *
 * This intentionally does NOT open any tab or otherwise touch the user's
 * browser chrome. Earlier versions auto-opened `changelog.html` in a new tab
 * on every install/update, which hijacked the browser homepage / new tab for
 * users with custom `browser.startup.homepage` / `browser.newtab.url` prefs
 * (see issue #5). The changelog remains reachable via the "What's New" link
 * in the options page.
 */
function recordInstalledVersion(): void {
  const currentVersion = chrome.runtime.getManifest().version;

  chrome.storage.local.set({ lastSeenVersion: currentVersion }, () => {
    if (chrome.runtime.lastError) {
      console.error(
        "[Code Formatter] Storage write error:",
        chrome.runtime.lastError.message,
      );
    }
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  const reason = details.reason;

  if (reason === "install") {
    console.log("[Code Formatter] Extension installed");
    chrome.storage.local.set(
      {
        javascriptOptions: { indent_size: 2 },
        cssOptions: { indent_size: 2 },
        htmlOptions: { indent_size: 2 },
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Code Formatter] Failed to set default options:",
            chrome.runtime.lastError.message,
          );
        }
      },
    );
  } else if (reason === "update") {
    console.log(`[Code Formatter] Updated from ${details.previousVersion}`);
  }

  recordInstalledVersion();
  initializeExtension();
});

chrome.runtime.onStartup.addListener(() => {
  console.log("[Code Formatter] Extension started");
  initializeExtension();
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

initializeExtension();
