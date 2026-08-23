import type { ExtensionSettings, FormatResponse } from "./shared/types";
import {
  ELEMENT_IDS,
  CSS_CLASSES,
  DEFAULT_SETTINGS,
  FORMATTABLE_LANGUAGES,
} from "./shared/constants";
import { LRUMap, debounce, isSiteIgnored } from "./shared/utils";
import { detectLanguage, appearsToBeCodePage } from "./content/detection";
import { showToast } from "./content/toast";
import {
  createEditor,
  getEditor,
  setEditor,
  applyTheme,
  updateEditorContent,
  destroyEditor,
  initEditor,
} from "./content/editor";
import {
  createToolbar,
  initToolbar,
  setEditorInstance,
  setCurrentLanguage,
  downloadCode,
  syncMinifyButton,
} from "./content/toolbar";
import { createStatusBar, updateStatusBarWithFile } from "./content/status-bar";
import {
  createFileInput,
  openFileDialog,
  setupDragDropZone,
  insertTextAtCursor,
  setFileSelectionHandler,
  getFileInputElement,
} from "./content/file-handling";

const currentSettings: ExtensionSettings = { ...DEFAULT_SETTINGS };
let currentEditorCode = "";
let currentEditorLanguage = "";
let isShowingOriginal = false;
let originalPreElement: HTMLElement | null = null;

const contentCache = new LRUMap<string, string>(20);
const eventCleanupFunctions: (() => void)[] = [];
let formatSequence = 0;

const debouncedFormat = debounce(async () => {
  const editor = getEditor();
  if (!editor || !currentEditorLanguage) return;

  const code = editor.state.doc.toString();
  if (!code.trim()) return;

  if (code.length > 100000) {
    console.warn("[Code Formatter] Code too large for format-on-type");
    return;
  }

  const currentSequence = ++formatSequence;

  try {
    const formatted = await formatCode(code, currentEditorLanguage);

    if (currentSequence === formatSequence) {
      const currentContent = editor.state.doc.toString();
      if (currentContent === code && formatted !== code) {
        editor.dispatch({
          changes: { from: 0, to: editor.state.doc.length, insert: formatted },
        });
        currentEditorCode = formatted;
      }
    }
  } catch (error) {
    console.error("[Code Formatter] Auto-format failed:", error);
  }
}, 500);

function registerEventListener(
  target: EventTarget,
  event: string,
  handler: EventListenerOrEventListenerObject,
  options?: AddEventListenerOptions,
): void {
  target.addEventListener(event, handler, options);
  const cleanup = () => target.removeEventListener(event, handler);
  eventCleanupFunctions.push(cleanup);
}

function loadSettings(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      [
        "indentSize",
        "quoteStyle",
        "theme",
        "fontSize",
        "lineHeight",
        "singleQuote",
        "semi",
        "trailingComma",
        "e4x",
        "spaceInEmptyParens",
        "unescapeStrings",
        "keepArrayIndentation",
        "quoteStyleWasm",
        "keywordCase",
        "commaPosition",
        "autoFormatOnType",
        "formatOnPasteMinLength",
        "minify",
        "ignoredSites",
      ],
      (result: Partial<ExtensionSettings>) => {
        Object.assign(currentSettings, result);
        if (Array.isArray(result.ignoredSites)) {
          (currentSettings as ExtensionSettings).ignoredSites = result.ignoredSites;
        }
        if (typeof result.minify === "boolean") {
          (currentSettings as ExtensionSettings).minify = result.minify;
        }
        resolve();
      },
    );
  });
}

function saveSettings(): void {
  chrome.storage.sync.set(currentSettings, () => {
    if (chrome.runtime.lastError) {
      console.error(
        "[Code Formatter] Failed to save settings:",
        chrome.runtime.lastError.message,
      );
    }
  });
}

function simpleHash(str: string): string {
  const SAMPLE_END = 8192;
  const TAIL_LEN = 2048;
  let hash = 0;

  const end = str.length < SAMPLE_END ? str.length : SAMPLE_END;
  for (let i = 0; i < end; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  if (str.length > SAMPLE_END) {
    const start = str.length - TAIL_LEN;
    for (let i = start; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    hash = (hash << 5) - hash + str.length;
    hash = hash & hash;
  }

  return hash.toString(36);
}

async function formatCode(code: string, language: string): Promise<string> {
  const cacheKey = `${language}:${code.length}:${simpleHash(code)}`;
  const cached = contentCache.get(cacheKey);
  if (cached) return cached;

  return new Promise((resolve) => {
    if (!chrome.runtime?.id) {
      console.warn("[Code Formatter] Extension context invalidated");
      resolve(code);
      return;
    }

    try {
      chrome.runtime.sendMessage(
        { action: "format", code, language, settings: currentSettings },
        (response: FormatResponse) => {
          if (chrome.runtime.lastError) {
            console.error(
              "[Code Formatter] Runtime error:",
              chrome.runtime.lastError.message,
            );
            resolve(code);
            return;
          }
          if (response?.success && response.code) {
            contentCache.set(cacheKey, response.code);
            resolve(response.code);
          } else {
            console.warn(
              "[Code Formatter] Formatting failed:",
              response?.error,
            );
            resolve(code);
          }
        },
      );
    } catch (error) {
      console.error("[Code Formatter] Failed to send message:", error);
      resolve(code);
    }
  });
}

function toggleOriginalCode(): void {
  isShowingOriginal = !isShowingOriginal;

  const renderer = document.getElementById(ELEMENT_IDS.RENDERER);
  const statusBar = document.getElementById(ELEMENT_IDS.STATUS_BAR);

  if (isShowingOriginal) {
    if (renderer) renderer.style.display = "none";
    if (statusBar) statusBar.style.display = "none";
    if (originalPreElement) {
      originalPreElement.style.display = "block";
      originalPreElement.style.paddingTop = "50px";
    }
    document.body.classList.remove(CSS_CLASSES.LOADED);
    document.documentElement.classList.remove(CSS_CLASSES.LOADED);
  } else {
    if (renderer) renderer.style.display = "block";
    if (statusBar) statusBar.style.display = "flex";
    if (originalPreElement) {
      originalPreElement.style.display = "none";
      originalPreElement.style.paddingTop = "";
    }
    document.body.classList.add(CSS_CLASSES.LOADED);
    document.documentElement.classList.add(CSS_CLASSES.LOADED);
  }
}

function showLoadingSkeleton(): HTMLElement {
  const skeleton = document.createElement("div");
  skeleton.className = CSS_CLASSES.SKELETON;

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 20; i++) {
    const line = document.createElement("div");
    line.className = CSS_CLASSES.SKELETON_LINE;
    line.style.width = `${30 + Math.random() * 60}%`;
    fragment.appendChild(line);
  }
  skeleton.appendChild(fragment);
  document.body.appendChild(skeleton);
  return skeleton;
}

function extractOriginalCode(): string {
  const pre = document.querySelector("body > pre");
  if (pre?.textContent) return pre.textContent;
  // Fall back to the cheaper textContent (no forced layout/reflow) instead
  // of innerText, which would invoke expensive layout calculations on huge
  // pages and degrades the host page's main thread.
  return document.body.textContent || "";
}

async function reformatCurrentEditor(): Promise<void> {
  if (!currentEditorCode || !currentEditorLanguage) return;
  const formatted = await formatCode(currentEditorCode, currentEditorLanguage);
  const editor = getEditor();
  if (editor && formatted !== currentEditorCode) {
    editor.dispatch({
      changes: {
        from: 0,
        to: editor.state.doc.length,
        insert: formatted,
      },
    });
    currentEditorCode = formatted;
  }
}

async function toggleMinify(): Promise<void> {
  currentSettings.minify = !currentSettings.minify;
  saveSettings();
  syncMinifyButton();
  await reformatCurrentEditor();
  showToast(
    currentSettings.minify ? "Minified" : "Formatted",
    "info",
    1500,
  );
}

async function autoFormatPage(): Promise<void> {
  console.log("[Code Formatter] Auto-formatting...");

  const skeleton = showLoadingSkeleton();

  try {
    const code = extractOriginalCode();
    const lang = detectLanguage(code);

    if (!lang) {
      skeleton.remove();
      const pre = document.querySelector("body > pre");
      if (pre) (pre as HTMLElement).style.display = "block";
      showToast("Unable to detect code language.", "error");
      return;
    }

    const formattedCode = await formatCode(code, lang);

    isShowingOriginal = false;
    originalPreElement = document.querySelector(
      "body > pre",
    ) as HTMLElement | null;
    if (originalPreElement) originalPreElement.style.display = "none";

    skeleton.remove();

    const renderer = document.createElement("div");
    renderer.id = ELEMENT_IDS.RENDERER;
    renderer.style.cssText =
      "position:absolute;width:100%;height:calc(100vh - 62px);top:38px;right:0;overflow:auto;";
    document.body.appendChild(renderer);

    currentEditorCode = formattedCode;
    currentEditorLanguage = lang;

    initEditor(currentSettings);
    const editor = await createEditor(renderer, formattedCode, lang, () =>
      debouncedFormat(),
    );
    setEditor(editor);
    setEditorInstance(editor);
    setCurrentLanguage(lang);

    initToolbar(currentSettings, {
      saveSettings,
      applyTheme,
      toggleOriginal: toggleOriginalCode,
      openFileDialog,
      getCode: () => currentEditorCode,
      onDownload: downloadCode,
      batchFormat: batchFormatAllBlocks,
      toggleMinify,
    });

    const toolbar = createToolbar();
    document.body.appendChild(toolbar);

    const statusBar = createStatusBar(lang, formattedCode, currentSettings);
    document.body.appendChild(statusBar);

    document.documentElement.classList.add(CSS_CLASSES.LOADED);
    document.body.classList.add(CSS_CLASSES.LOADED);

    setupMessageListener();
    setupFormatOnPaste();
    setupDragDropZone(registerEventListener);
    setupKeyboardShortcuts();

    const fileInput = createFileInput();
    document.body.appendChild(fileInput);

    setFileSelectionHandler(async (code, language, fileInfo) => {
      const formatted = await formatCode(code, language);
      updateEditorContent(formatted);
      currentEditorCode = formatted;
      currentEditorLanguage = language;
      setCurrentLanguage(language);
      updateStatusBarWithFile(fileInfo);
    });

    console.log("[Code Formatter] Done");
  } catch (e) {
    skeleton.remove();
    console.error("[Code Formatter] Error:", e);
  }
}

function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === "getLanguage") {
      const content = document.body.textContent || "";
      const limitedContent =
        content.length > 50000 ? content.substring(0, 50000) : content;
      const lang = detectLanguage(limitedContent);
      sendResponse({ status: "success", language: lang });
      return true;
    }

    if (message.action === "formatSelection") {
      const formatMsg = message as {
        action: string;
        language: string;
        code: string;
      };
      const lang = formatMsg.language;
      const code = formatMsg.code;

      if (!code || !lang) {
        sendResponse({ success: false, error: "Missing code or language" });
        return true;
      }

      formatCode(code, lang).then((formatted) => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectedNode = range.startContainer;
          const parentElement = selectedNode.parentElement;

          if (parentElement && parentElement.tagName === "PRE") {
            parentElement.textContent = formatted;
            selectedNode.parentElement?.normalize();
          } else if (selectedNode.nodeType === Node.TEXT_NODE) {
            selectedNode.textContent = formatted;
          }
        }

        sendResponse({ success: true, code: formatted });
      });

      return true;
    }

    return false;
  });
}

function setupFormatOnPaste(): void {
  let isProcessing = false;

  registerEventListener(document, "paste", async (_e: Event) => {
    if (isProcessing) return;

    const e = _e as ClipboardEvent;
    const target = e.target as HTMLElement;

    if (target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") return;

    const pastedText = e.clipboardData?.getData("text/plain");
    if (!pastedText) return;

    const minLength = currentSettings.formatOnPasteMinLength ?? 5;
    if (pastedText.length < minLength) return;

    const detectedLang = detectLanguage(pastedText);
    if (!detectedLang || !FORMATTABLE_LANGUAGES.has(detectedLang)) return;

    e.preventDefault();
    isProcessing = true;

    try {
      const formatted = await formatCode(pastedText, detectedLang);

      if (
        document.activeElement === target &&
        (target.tagName === "TEXTAREA" || target.tagName === "INPUT")
      ) {
        insertTextAtCursor(
          target as HTMLTextAreaElement | HTMLInputElement,
          formatted,
        );
      }
    } catch (error) {
      console.error("[Code Formatter] Format on paste failed:", error);
      insertTextAtCursor(
        target as HTMLTextAreaElement | HTMLInputElement,
        pastedText,
      );
    } finally {
      isProcessing = false;
    }
  });
}

function setupKeyboardShortcuts(): void {
  registerEventListener(document, "keydown", (e: Event) => {
    const keyEvent = e as KeyboardEvent;

    if (keyEvent.ctrlKey && keyEvent.shiftKey && keyEvent.key === "C") {
      keyEvent.preventDefault();
      if (currentEditorCode) {
        navigator.clipboard.writeText(currentEditorCode);
      }
    }

    if (keyEvent.ctrlKey && keyEvent.shiftKey && keyEvent.key === "F") {
      keyEvent.preventDefault();
      reformatCurrentEditor();
    }

    if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.key === "o") {
      keyEvent.preventDefault();
      openFileDialog();
    }

    if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.key === "s") {
      keyEvent.preventDefault();
      reformatCurrentEditor();
    }

    if (keyEvent.ctrlKey && keyEvent.shiftKey && keyEvent.key === "B") {
      keyEvent.preventDefault();
      batchFormatAllBlocks();
    }

    if (keyEvent.ctrlKey && keyEvent.shiftKey && keyEvent.key === "M") {
      keyEvent.preventDefault();
      void toggleMinify();
    }
  });
}

function cleanup(): void {
  for (const cleanupFn of eventCleanupFunctions) cleanupFn();
  eventCleanupFunctions.length = 0;

  destroyEditor();

  document.getElementById(ELEMENT_IDS.DROP_ZONE)?.remove();
  document.getElementById(ELEMENT_IDS.TOOLBAR)?.remove();
  document.getElementById(ELEMENT_IDS.STATUS_BAR)?.remove();
  document.getElementById(ELEMENT_IDS.RENDERER)?.remove();
  getFileInputElement()?.remove();

  document.body?.classList.remove(CSS_CLASSES.LOADED);
  console.log("[Code Formatter] Cleanup completed");
}

async function batchFormatAllBlocks(): Promise<void> {
  const preElements = document.querySelectorAll("pre");
  if (preElements.length === 0) {
    showToast("No code blocks found on this page.", "warning");
    return;
  }

  showToast(`Formatting ${preElements.length} code block(s)...`, "info");

  let successCount = 0;
  let errorCount = 0;
  const CONCURRENCY = 4;

  // Snapshot jobs up front and run with a small worker pool so that big
  // pages make use of parallelism while still bounding in-flight requests.
  const jobs: { el: HTMLPreElement; code: string; lang: string }[] = [];
  for (const pre of Array.from(preElements)) {
    const code = pre.textContent || "";
    if (!code.trim()) continue;
    const lang = detectLanguage(code);
    if (!lang) continue;
    jobs.push({ el: pre as HTMLPreElement, code, lang });
  }

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < jobs.length) {
      const idx = cursor++;
      const job = jobs[idx];
      try {
        const formatted = await formatCode(job.code, job.lang);
        if (formatted !== job.code) {
          job.el.textContent = formatted;
          successCount++;
        }
      } catch {
        errorCount++;
      }
    }
  };
  const pool = Array.from(
    { length: Math.min(CONCURRENCY, Math.max(jobs.length, 1)) },
    () => worker(),
  );
  await Promise.all(pool);

  showToast(
    `Batch format complete: ${successCount} formatted, ${errorCount} errors`,
    successCount > 0 ? "success" : "error",
  );
}

async function main(): Promise<void> {
  await loadSettings();

  const init = async () => {
    if (isSiteIgnored(location.hostname, currentSettings.ignoredSites ?? [])) {
      console.log(
        "[Code Formatter] Skipping initialization for ignored site:",
        location.hostname,
      );
      return;
    }
    if (appearsToBeCodePage()) {
      await autoFormatPage();
    }
  };

  if (document.readyState === "loading") {
    registerEventListener(document, "DOMContentLoaded", () => {
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(() => init(), { timeout: 2000 });
      } else {
        setTimeout(init, 500);
      }
    });
  } else {
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(() => init(), { timeout: 2000 });
    } else {
      setTimeout(init, 500);
    }
  }
}

registerEventListener(window, "beforeunload", cleanup);

main();
