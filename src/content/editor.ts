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
import { COLORS } from "../shared/constants";
import { PERFORMANCE_THRESHOLDS } from "../shared/constants";
import { getSearchHighlightExtension } from "./search-highlight";
import type { ExtensionSettings, ThemeName } from "../shared/types";

const DARK_THEMES: ThemeName[] = [
  "one-dark-pro",
  "dracula",
  "nord",
  "monokai",
  "material",
  "github-dark",
  "solarized-dark",
  "tokyo-night",
];

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
}

function updateThemeAttribute(): void {
  const isDark = DARK_THEMES.includes(currentSettings.theme);
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

export function getThemeCompartment(): Compartment {
  return themeCompartment;
}

export function getLanguageCompartment(): Compartment {
  return languageCompartment;
}

function getLanguageExtension(language: string): Extension {
  const lang = language.toLowerCase();
  switch (lang) {
    case "javascript":
    case "typescript":
    case "jsx":
    case "tsx":
      return javascript();
    case "json":
      return json();
    case "css":
    case "scss":
    case "less":
      return css();
    case "html":
    case "xml":
    case "svg":
      return html();
    case "python":
    case "py":
      return python();
    case "sql":
      return sql();
    case "markdown":
    case "md":
      return markdown();
    default:
      return [];
  }
}

function getBaseThemeExtensions(): Extension[] {
  const isDark = DARK_THEMES.includes(currentSettings.theme);
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

  if (currentSettings.theme === "one-dark-pro") {
    exts.push(oneDark);
  } else if (currentSettings.theme) {
    try {
      const theme = await loadTheme(currentSettings.theme);
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

  const lineCount = code.split("\n").length;
  const isLargeFile = lineCount > PERFORMANCE_THRESHOLDS.LARGE_FILE_LINES;
  const isHugeFile = lineCount > PERFORMANCE_THRESHOLDS.HUGE_FILE_LINES;

  if (isLargeFile) {
    console.log(
      `[Code Formatter] Large file detected (${lineCount} lines), optimizing...`,
    );
  }

  const extensions: Extension[] = [
    lineNumbers(),
    isHugeFile ? bracketMatching() : bracketMatching(),
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
}

export { DARK_THEMES };
