import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { EditorState, Extension, Compartment } from "@codemirror/state";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  codeFolding,
  indentOnInput,
} from "@codemirror/language";
import { search, highlightSelectionMatches } from "@codemirror/search";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { python } from "@codemirror/lang-python";
import { sql } from "@codemirror/lang-sql";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { COLORS, PERFORMANCE_THRESHOLDS } from "../shared/constants";
import { countNewlines } from "../shared/utils";
import { getSearchHighlightExtension } from "./search-highlight";
import { createLintExtension } from "./lint";
import type { ExtensionSettings, ThemeName } from "../shared/types";

const DARK_THEMES: ReadonlySet<ThemeName> = new Set([
  "one-dark-pro",
  "dracula",
  "nord",
  "monokai",
  "material",
  "github-dark",
  "solarized-dark",
  "tokyo-night",
]);

/** Theme used when the user selects "auto" on a light system */
const AUTO_LIGHT_THEME: ThemeName = "github-light";
/** Theme used when the user selects "auto" on a dark system */
const AUTO_DARK_THEME: ThemeName = "one-dark-pro";

let autoThemeQuery: MediaQueryList | null = null;
let autoThemeListener: (() => void) | null = null;

/**
 * Resolve a configured theme to a concrete one. The special "auto" value
 * follows the OS prefers-color-scheme setting.
 */
export function resolveThemeName(theme: ThemeName): ThemeName {
  if (theme !== "auto") return theme;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? AUTO_DARK_THEME
      : AUTO_LIGHT_THEME;
  } catch {
    return AUTO_DARK_THEME;
  }
}

const themeCompartment = new Compartment();
const languageCompartment = new Compartment();
const wrapCompartment = new Compartment();

let editorInstance: EditorView | null = null;
let currentSettings: ExtensionSettings;

const themeCache = new Map<ThemeName, Extension>();

themeCache.set("one-dark-pro", oneDark);

async function loadTheme(theme: ThemeName): Promise<Extension> {
  if (themeCache.has(theme)) {
    return themeCache.get(theme)!;
  }

  let themeExtension: Extension;

  switch (theme) {
    case "dracula":
      themeExtension = (await import("@uiw/codemirror-theme-dracula")).dracula;
      break;
    case "nord":
      themeExtension = (await import("@uiw/codemirror-theme-nord")).nord;
      break;
    case "monokai":
      themeExtension = (await import("@uiw/codemirror-theme-monokai")).monokai;
      break;
    case "material":
      themeExtension = (await import("@uiw/codemirror-theme-material"))
        .material;
      break;
    case "github-dark":
      themeExtension = (await import("@uiw/codemirror-theme-github"))
        .githubDark;
      break;
    case "github-light":
      themeExtension = (await import("@uiw/codemirror-theme-github"))
        .githubLight;
      break;
    case "solarized-light":
      themeExtension = (await import("@uiw/codemirror-theme-solarized"))
        .solarizedLight;
      break;
    case "solarized-dark":
      themeExtension = (await import("@uiw/codemirror-theme-solarized"))
        .solarizedDark;
      break;
    case "tokyo-night":
      themeExtension = (await import("@uiw/codemirror-theme-tokyo-night"))
        .tokyoNight;
      break;
    default:
      themeExtension = syntaxHighlighting(defaultHighlightStyle);
      break;
  }

  themeCache.set(theme, themeExtension);
  return themeExtension;
}

export function initEditor(settings: ExtensionSettings): void {
  currentSettings = settings;
  updateThemeAttribute();

  // Live-switch when the OS theme flips while "auto" is selected
  try {
    if (!autoThemeQuery) {
      autoThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    }
    if (autoThemeQuery && !autoThemeListener) {
      autoThemeListener = () => {
        if (currentSettings?.theme === "auto") {
          void applyTheme();
        }
      };
      autoThemeQuery.addEventListener("change", autoThemeListener);
    }
  } catch {
    // matchMedia unavailable; static theme fallback applies
  }
}

function updateThemeAttribute(): void {
  const isDark = DARK_THEMES.has(resolveThemeName(currentSettings.theme));
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "dark" : "light",
  );
}

export function getEditor(): EditorView | null {
  return editorInstance;
}

export function setEditor(editor: EditorView | null): void {
  editorInstance = editor;
}

const languageExtCache = new Map<string, Extension>();

function getLanguageExtension(language: string): Extension {
  const lang = language.toLowerCase();
  const cached = languageExtCache.get(lang);
  if (cached) return cached;

  let ext: Extension;
  switch (lang) {
    case "javascript":
    case "typescript":
    case "jsx":
    case "tsx":
      ext = javascript();
      break;
    case "json":
      ext = json();
      break;
    case "css":
    case "scss":
    case "less":
      ext = css();
      break;
    case "html":
    case "xml":
    case "svg":
      ext = html();
      break;
    case "python":
    case "py":
      ext = python();
      break;
    case "sql":
      ext = sql();
      break;
    case "markdown":
    case "md":
      ext = markdown();
      break;
    default:
      ext = [];
      break;
  }

  languageExtCache.set(lang, ext);
  return ext;
}

function getBaseThemeExtensions(): Extension[] {
  const isDark = DARK_THEMES.has(resolveThemeName(currentSettings.theme));
  const bg = isDark ? COLORS.EDITOR_BG_DARK : COLORS.EDITOR_BG_LIGHT;
  const fg = isDark ? COLORS.EDITOR_FG_DARK : COLORS.EDITOR_FG_LIGHT;
  const gutterBg = isDark ? COLORS.GUTTER_BG_DARK : COLORS.GUTTER_BG_LIGHT;
  const gutterFg = isDark ? COLORS.GUTTER_FG_DARK : COLORS.GUTTER_FG_LIGHT;

  return [
    EditorView.theme({
      "&": {
        backgroundColor: bg,
        color: fg,
        fontSize: `${currentSettings.fontSize}px`,
      },
      ".cm-content": {
        backgroundColor: bg,
        color: fg,
        lineHeight: String(currentSettings.lineHeight),
        fontFamily: "'SF Mono', Monaco, Consolas, monospace",
      },
      ".cm-gutters": {
        backgroundColor: gutterBg,
        color: gutterFg,
        borderRight: "1px solid #3e4451",
      },
      ".cm-activeLineGutter": {
        backgroundColor: isDark ? "#2c313c" : "#f0f0f0",
      },
      ".cm-activeLine": {
        backgroundColor: isDark ? "#2c313c" : "#f0f0f0",
      },
      ".cm-selectionBackground": {
        backgroundColor: isDark ? "#3e4451" : "#b4d5fe",
      },
    }),
  ];
}

async function getThemeExtensions(): Promise<Extension[]> {
  const exts: Extension[] = [];
  const resolvedTheme = resolveThemeName(currentSettings.theme);

  if (resolvedTheme === "one-dark-pro") {
    exts.push(oneDark);
  } else if (resolvedTheme) {
    try {
      const theme = await loadTheme(resolvedTheme);
      exts.push(theme);
    } catch {
      exts.push(syntaxHighlighting(defaultHighlightStyle));
    }
  } else {
    exts.push(syntaxHighlighting(defaultHighlightStyle));
  }

  exts.push(...getBaseThemeExtensions());
  return exts;
}

export async function createEditor(
  container: HTMLElement,
  code: string,
  language: string,
  onUpdate?: () => void,
): Promise<EditorView> {
  console.log("[Code Formatter] Creating editor:", language);

  const isEditable = currentSettings.autoFormatOnType ?? false;
  const themeExts = await getThemeExtensions();

  const lineCount = countNewlines(code);
  const isLargeFile = lineCount > PERFORMANCE_THRESHOLDS.LARGE_FILE_LINES;
  const isHugeFile = lineCount > PERFORMANCE_THRESHOLDS.HUGE_FILE_LINES;

  if (isLargeFile) {
    console.log(
      `[Code Formatter] Large file detected (${lineCount} lines), optimizing...`,
    );
  }

  const extensions: Extension[] = [
    lineNumbers(),
    !isHugeFile ? bracketMatching() : null,
    !isHugeFile ? codeFolding() : null,
    !isHugeFile ? foldGutter() : null,
    indentOnInput(),
    search({ top: isLargeFile }),
    !isHugeFile ? highlightSelectionMatches() : null,
    getSearchHighlightExtension(),
    keymap.of([
      ...defaultKeymap,
      ...(!isHugeFile ? foldKeymap : []),
      indentWithTab,
    ]),
    languageCompartment.of(getLanguageExtension(language)),
    themeCompartment.of(themeExts),
    wrapCompartment.of(currentSettings.wrapLines ? EditorView.lineWrapping : []),
    EditorView.editable.of(isEditable && !isHugeFile),
    ...(!isHugeFile ? createLintExtension(language) : []),
  ].filter(Boolean) as Extension[];

  if (isEditable && onUpdate && !isHugeFile) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onUpdate();
        }
      }),
    );
  }

  const state = EditorState.create({ doc: code, extensions });
  editorInstance = new EditorView({ state, parent: container });
  return editorInstance;
}

export async function applyTheme(): Promise<void> {
  updateThemeAttribute();
  if (editorInstance) {
    const themeExts = await getThemeExtensions();
    editorInstance.dispatch({
      effects: themeCompartment.reconfigure(themeExts),
    });
  }
}

export function applyLanguage(language: string): void {
  if (editorInstance) {
    editorInstance.dispatch({
      effects: languageCompartment.reconfigure(getLanguageExtension(language)),
    });
  }
}

export function updateEditorContent(code: string): void {
  if (editorInstance) {
    editorInstance.dispatch({
      changes: {
        from: 0,
        to: editorInstance.state.doc.length,
        insert: code,
      },
    });
  }
}

export function getEditorContent(): string {
  if (editorInstance) {
    return editorInstance.state.doc.toString();
  }
  return "";
}

export function updateSettings(settings: ExtensionSettings): void {
  currentSettings = settings;
  applyTheme();
  if (editorInstance) {
    editorInstance.dispatch({
      effects: wrapCompartment.reconfigure(
        settings.wrapLines ? EditorView.lineWrapping : [],
      ),
    });
  }
}

export function destroyEditor(): void {
  if (editorInstance) {
    editorInstance.destroy();
    editorInstance = null;
  }

  if (autoThemeQuery && autoThemeListener) {
    try {
      autoThemeQuery.removeEventListener("change", autoThemeListener);
    } catch {
      // ignore
    }
    autoThemeListener = null;
  }
}

export { DARK_THEMES };
