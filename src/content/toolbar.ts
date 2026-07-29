import { foldAll, unfoldAll } from "@codemirror/language";
import { EditorSelection, type Range } from "@codemirror/state";
import { EditorView, Decoration } from "@codemirror/view";
import {
  ELEMENT_IDS,
  CSS_CLASSES,
  AVAILABLE_THEMES,
  EXTENSIONS_BY_LANGUAGE,
} from "../shared/constants";
import type { ExtensionSettings, ThemeName } from "../shared/types";
import {
  searchHighlightEffect,
  searchMatchDecoration,
  searchMatchSelectedDecoration,
} from "./search-highlight";

const DANGEROUS_SVG_ELEMENTS = [
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "use",
  "animate",
  "set",
];

const DANGEROUS_SVG_ATTRS = [
  "onload",
  "onclick",
  "onerror",
  "onmouseover",
  "onfocus",
  "onblur",
  "onchange",
  "onsubmit",
  "onkeydown",
  "onkeyup",
  "onkeypress",
  "onanimationstart",
  "onanimationend",
  "onanimationiteration",
  "ontransitionend",
  "href",
  "xlink:href",
  "ping",
  "formaction",
  "poster",
  "src",
  "data",
  "xmlns:xlink",
];

const DANGEROUS_URL_PROTOCOLS = ["javascript:", "data:", "vbscript:", "file:"];

let currentSettings: ExtensionSettings;
let editorInstance: EditorView | null = null;
let currentLanguage = "";

type SaveSettingsCallback = () => void;
type ApplyThemeCallback = () => void;
type ToggleOriginalCallback = () => void;
type OpenFileDialogCallback = () => void;
type GetCodeCallback = () => string;
type BatchFormatCallback = () => void;

let onSaveSettings: SaveSettingsCallback | null = null;
let onApplyTheme: ApplyThemeCallback | null = null;
let onToggleOriginal: ToggleOriginalCallback | null = null;
let onOpenFileDialog: OpenFileDialogCallback | null = null;
let onGetCode: GetCodeCallback | null = null;
let onDownload: ((code: string, language: string) => void) | null = null;
let onBatchFormat: BatchFormatCallback | null = null;

export function initToolbar(
  settings: ExtensionSettings,
  callbacks: {
    saveSettings?: SaveSettingsCallback;
    applyTheme?: ApplyThemeCallback;
    toggleOriginal?: ToggleOriginalCallback;
    openFileDialog?: OpenFileDialogCallback;
    getCode?: GetCodeCallback;
    onDownload?: (code: string, language: string) => void;
    batchFormat?: BatchFormatCallback;
  },
): void {
  currentSettings = settings;
  onSaveSettings = callbacks.saveSettings ?? null;
  onApplyTheme = callbacks.applyTheme ?? null;
  onToggleOriginal = callbacks.toggleOriginal ?? null;
  onOpenFileDialog = callbacks.openFileDialog ?? null;
  onGetCode = callbacks.getCode ?? null;
  onDownload = callbacks.onDownload ?? null;
  onBatchFormat = callbacks.batchFormat ?? null;
}

export function setEditorInstance(editor: EditorView | null): void {
  editorInstance = editor;
}

export function setCurrentLanguage(language: string): void {
  currentLanguage = language;
}

function isDangerousUrl(value: string): boolean {
  const lower = value.toLowerCase().trim();
  return DANGEROUS_URL_PROTOCOLS.some((proto) => lower.startsWith(proto));
}

export function sanitizeSvg(svgElement: SVGElement): SVGElement {
  for (const tagName of DANGEROUS_SVG_ELEMENTS) {
    const elements = svgElement.querySelectorAll(tagName);
    elements.forEach((el) => el.remove());
  }

  const allElements = svgElement.querySelectorAll("*");
  allElements.forEach((el) => {
    const elAttrs = Array.from(el.attributes);
    for (const attr of elAttrs) {
      if (DANGEROUS_SVG_ATTRS.includes(attr.name.toLowerCase())) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (attr.name.toLowerCase().startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        ["href", "src", "xlink:href", "data", "poster", "formaction"].includes(
          attr.name.toLowerCase(),
        ) &&
        isDangerousUrl(attr.value)
      ) {
        el.removeAttribute(attr.name);
      }
    }
  });

  const rootAttrs = Array.from(svgElement.attributes);
  for (const attr of rootAttrs) {
    if (DANGEROUS_SVG_ATTRS.includes(attr.name.toLowerCase())) {
      svgElement.removeAttribute(attr.name);
      continue;
    }
    if (attr.name.toLowerCase().startsWith("on")) {
      svgElement.removeAttribute(attr.name);
      continue;
    }
    if (
      ["href", "src", "xlink:href"].includes(attr.name.toLowerCase()) &&
      isDangerousUrl(attr.value)
    ) {
      svgElement.removeAttribute(attr.name);
    }
  }

  svgElement.removeAttribute("xmlns:xlink");
  return svgElement;
}

export function createToolbarButton(
  id: string,
  title: string,
  iconSvg: string,
  text?: string,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = id;
  btn.className = CSS_CLASSES.TOOLBAR_BUTTON;
  btn.title = title;

  const iconContainer = document.createElement("span");
  const parser = new DOMParser();

  const svgWithNs = iconSvg.includes("xmlns")
    ? iconSvg
    : iconSvg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');

  const doc = parser.parseFromString(svgWithNs, "image/svg+xml");
  const svgElement = doc.documentElement;

  if (svgElement instanceof SVGElement) {
    const sanitizedSvg = sanitizeSvg(svgElement);
    iconContainer.appendChild(sanitizedSvg);
  }

  btn.appendChild(iconContainer);
  if (text) {
    const label = document.createElement("span");
    label.style.marginLeft = "4px";
    label.textContent = text;
    btn.appendChild(label);
  }
  return btn;
}

export function createSeparator(): HTMLElement {
  const sep = document.createElement("div");
  sep.className = CSS_CLASSES.TOOLBAR_SEPARATOR;
  return sep;
}

interface SearchResult {
  from: number;
  to: number;
}

function createSearchBar(
  editor: EditorView | null,
  onClose: () => void,
): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "code-formatter-search-bar";
  bar.style.display = "none";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Find...";
  input.className = "code-formatter-search-input";

  const prevBtn = document.createElement("button");
  prevBtn.className = "code-formatter-search-btn";
  prevBtn.title = "Previous (Shift+Enter)";
  prevBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>';

  const nextBtn = document.createElement("button");
  nextBtn.className = "code-formatter-search-btn";
  nextBtn.title = "Next (Enter)";
  nextBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';

  const closeBtn = document.createElement("button");
  closeBtn.className = "code-formatter-search-btn code-formatter-search-close";
  closeBtn.title = "Close (Esc)";
  closeBtn.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

  const matchCount = document.createElement("span");
  matchCount.className = "code-formatter-search-count";

  let currentMatches: SearchResult[] = [];
  let currentMatchIndex = -1;

  const findMatches = (searchTerm: string): SearchResult[] => {
    if (!editor || !searchTerm) return [];

    const matches: SearchResult[] = [];
    const text = editor.state.doc.toString();

    try {
      const regex = new RegExp(
        searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "gi",
      );

      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          from: match.index,
          to: match.index + match[0].length,
        });
      }
    } catch {
      // Invalid regex
    }

    return matches;
  };

  const updateMatchCount = () => {
    if (currentMatches.length === 0) {
      matchCount.textContent = input.value ? "No matches" : "";
    } else {
      matchCount.textContent = `${currentMatchIndex + 1} of ${currentMatches.length}`;
    }
  };

  const updateDecorations = () => {
    if (!editor) return;

    const ranges: Range<Decoration>[] = currentMatches.map((match, index) => {
      if (index === currentMatchIndex) {
        return searchMatchSelectedDecoration.range(match.from, match.to);
      }
      return searchMatchDecoration.range(match.from, match.to);
    });

    editor.dispatch({
      effects: searchHighlightEffect.of(Decoration.set(ranges, true)),
    });
  };

  const highlightMatch = (index: number) => {
    if (!editor || currentMatches.length === 0) return;

    const match = currentMatches[index];

    editor.dispatch({
      effects: EditorView.scrollIntoView(match.from, { y: "center" }),
    });

    editor.dispatch({
      selection: EditorSelection.create([
        EditorSelection.range(match.from, match.to),
        EditorSelection.cursor(match.to),
      ]),
      scrollIntoView: true,
    });

    currentMatchIndex = index;
    updateMatchCount();
    updateDecorations();
  };

  const performSearch = () => {
    if (!editor) return;

    const searchTerm = input.value;

    if (!searchTerm) {
      currentMatches = [];
      currentMatchIndex = -1;
      matchCount.textContent = "";
      editor.dispatch({
        effects: searchHighlightEffect.of(Decoration.none),
      });
      return;
    }

    currentMatches = findMatches(searchTerm);
    currentMatchIndex = currentMatches.length > 0 ? 0 : -1;

    updateDecorations();

    if (currentMatches.length > 0) {
      highlightMatch(0);
    }

    updateMatchCount();
  };

  const goToNext = () => {
    if (currentMatches.length === 0) return;

    const nextIndex = (currentMatchIndex + 1) % currentMatches.length;
    highlightMatch(nextIndex);
  };

  const goToPrev = () => {
    if (currentMatches.length === 0) return;

    const prevIndex =
      currentMatchIndex <= 0
        ? currentMatches.length - 1
        : currentMatchIndex - 1;
    highlightMatch(prevIndex);
  };

  const closeSearchBar = () => {
    bar.style.display = "none";

    if (editor) {
      editor.dispatch({
        effects: searchHighlightEffect.of(Decoration.none),
      });
    }

    onClose();
  };

  // Debounce search input
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  input.addEventListener("input", () => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 150);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrev();
      } else {
        goToNext();
      }
    } else if (e.key === "Escape") {
      closeSearchBar();
    }
  });

  nextBtn.addEventListener("click", goToNext);
  prevBtn.addEventListener("click", goToPrev);
  closeBtn.addEventListener("click", closeSearchBar);

  bar.appendChild(input);
  bar.appendChild(prevBtn);
  bar.appendChild(nextBtn);
  bar.appendChild(matchCount);
  bar.appendChild(closeBtn);

  return bar;
}

export function createToolbar(): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.id = ELEMENT_IDS.TOOLBAR;
  toolbar.className = CSS_CLASSES.TOOLBAR;

  // Open File button
  const openFileBtn = createToolbarButton(
    ELEMENT_IDS.BUTTON_OPEN_FILE,
    "Open File (Ctrl+O)",
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 1-2-2v16a2 2 0 0 1 2 2h12a2 2 0 0 1 2 2V4a2 2 0 0 1 2-2z"></path><polyline points="14 2 14 22 8 22 8 22"></polyline><line x1="2" y1="2" x2="22" y2="2"></line></svg>',
    "Open",
  );
  openFileBtn.addEventListener("click", () => onOpenFileDialog?.());
  toolbar.appendChild(openFileBtn);
  toolbar.appendChild(createSeparator());

  // Theme selector
  const themeSel = document.createElement("select");
  themeSel.id = ELEMENT_IDS.BUTTON_THEME;
  themeSel.className = CSS_CLASSES.TOOLBAR_SELECT;
  AVAILABLE_THEMES.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.value;
    opt.textContent = t.label;
    if (t.value === currentSettings.theme) opt.selected = true;
    themeSel.appendChild(opt);
  });
  themeSel.addEventListener("change", (e: Event) => {
    const target = e.target as HTMLSelectElement;
    currentSettings.theme = target.value as ThemeName;
    onApplyTheme?.();
    onSaveSettings?.();
  });
  toolbar.appendChild(themeSel);
  toolbar.appendChild(createSeparator());

  // Collapse button
  const collapseBtn = createToolbarButton(
    ELEMENT_IDS.BUTTON_COLLAPSE,
    "Collapse All",
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>',
  );
  collapseBtn.addEventListener("click", () => {
    if (editorInstance) foldAll(editorInstance);
  });
  toolbar.appendChild(collapseBtn);

  // Expand button
  const expandBtn = createToolbarButton(
    ELEMENT_IDS.BUTTON_EXPAND,
    "Expand All",
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>',
  );
  expandBtn.addEventListener("click", () => {
    if (editorInstance) unfoldAll(editorInstance);
  });
  toolbar.appendChild(expandBtn);

  // Toggle Original/Formatted button
  const toggleOriginalBtn = createToolbarButton(
    "code-formatter-toggle-original",
    "Show Original Code",
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><circle cx="11" cy="11" r="2"></circle></svg>',
    "Original",
  );
  toggleOriginalBtn.addEventListener("click", () => {
    onToggleOriginal?.();
    toggleOriginalBtn.classList.toggle("active", true);
  });
  toolbar.appendChild(toggleOriginalBtn);

  toolbar.appendChild(createSeparator());

  // Search button
  const searchBtn = createToolbarButton(
    ELEMENT_IDS.BUTTON_SEARCH,
    "Search (Ctrl+F)",
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>',
    "Find",
  );

  const searchBar = createSearchBar(editorInstance, () => {
    searchBtn.classList.remove("active");
  });
  toolbar.appendChild(searchBar);

  searchBtn.addEventListener("click", () => {
    const isVisible = searchBar.style.display !== "none";
    if (isVisible) {
      searchBar.style.display = "none";
      searchBtn.classList.remove("active");
    } else {
      searchBar.style.display = "flex";
      searchBtn.classList.add("active");
      const input = searchBar.querySelector("input");
      input?.focus();
      input?.select();
    }
  });
  toolbar.appendChild(searchBtn);

  toolbar.appendChild(createSeparator());

  // Batch Format All button
  const batchFormatBtn = createToolbarButton(
    "code-formatter-batch-format",
    "Format All Blocks (Ctrl+Shift+B)",
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>',
    "Batch Format",
  );
  batchFormatBtn.addEventListener("click", () => {
    onBatchFormat?.();
  });
  toolbar.appendChild(batchFormatBtn);

  toolbar.appendChild(createSeparator());

  // Spacer
  const spacer = document.createElement("div");
  spacer.style.flex = "1";
  toolbar.appendChild(spacer);

  // Copy button
  const copyBtn = createToolbarButton(
    ELEMENT_IDS.BUTTON_COPY,
    "Copy",
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
    "Copy",
  );
  copyBtn.addEventListener("click", () => {
    const code = onGetCode?.() ?? "";
    navigator.clipboard.writeText(code);
  });
  toolbar.appendChild(copyBtn);

  // Download button
  const downloadBtn = createToolbarButton(
    ELEMENT_IDS.BUTTON_DOWNLOAD,
    "Download",
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
    "Download",
  );
  downloadBtn.addEventListener("click", () => {
    const code = onGetCode?.() ?? "";
    onDownload?.(code, currentLanguage);
  });
  toolbar.appendChild(downloadBtn);

  // Print button
  const printBtn = createToolbarButton(
    "code-formatter-print",
    "Print Formatted Code",
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>',
    "Print",
  );
  printBtn.addEventListener("click", () => {
    window.print();
  });
  toolbar.appendChild(printBtn);

  return toolbar;
}

export function getFileExtension(language: string): string {
  return EXTENSIONS_BY_LANGUAGE[language.toLowerCase()] || "txt";
}

export function downloadCode(code: string, language: string): void {
  const ext = getFileExtension(language);
  const blob = new Blob([code], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `formatted.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function updateSettings(settings: ExtensionSettings): void {
  currentSettings = settings;
}
