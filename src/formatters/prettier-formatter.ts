import type {
  IFormatter,
  FormatterMetadata,
  FormatResult,
  FormatterSettings,
} from "./types";

type PrettierModule = typeof import("prettier/standalone");
type PluginCache = Map<string, any>;

let prettier: PrettierModule | null = null;
let prettierLoadPromise: Promise<void> | null = null;

const pluginCache: PluginCache = new Map();

const PLUGIN_LOADERS: Record<string, () => Promise<any>> = {
  babel: () => import("prettier/plugins/babel"),
  estree: () => import("prettier/plugins/estree"),
  typescript: () => import("prettier/plugins/typescript"),
  postcss: () => import("prettier/plugins/postcss"),
  html: () => import("prettier/plugins/html"),
  markdown: () => import("prettier/plugins/markdown"),
};

async function loadPrettier(): Promise<PrettierModule> {
  if (prettier) return prettier;

  if (prettierLoadPromise) {
    await prettierLoadPromise;
    return prettier!;
  }

  prettierLoadPromise = (async () => {
    prettier = await import("prettier/standalone");
  })();

  await prettierLoadPromise;
  return prettier!;
}

async function loadPlugin(name: string): Promise<any> {
  if (pluginCache.has(name)) {
    return pluginCache.get(name);
  }

  const loader = PLUGIN_LOADERS[name];
  if (!loader) {
    throw new Error(`Unknown plugin: ${name}`);
  }

  const plugin = await loader();
  pluginCache.set(name, plugin);
  return plugin;
}

const BUILTIN_PARSERS = new Set(["dockerfile"]);

async function loadPluginsForLanguage(language: string): Promise<any[]> {
  const plugins: any[] = [];
  const lang = language.toLowerCase();

  if (BUILTIN_PARSERS.has(lang)) {
    return plugins;
  }

  switch (lang) {
    case "javascript":
      plugins.push(await loadPlugin("babel"), await loadPlugin("estree"));
      break;
    case "typescript":
      plugins.push(
        await loadPlugin("babel"),
        await loadPlugin("estree"),
        await loadPlugin("typescript"),
      );
      break;
    case "json":
      plugins.push(await loadPlugin("babel"));
      break;
    case "css":
    case "scss":
    case "less":
      plugins.push(await loadPlugin("postcss"));
      break;
    case "html":
      plugins.push(await loadPlugin("html"));
      break;
    case "markdown":
      plugins.push(await loadPlugin("markdown"));
      break;
  }

  return plugins;
}

export class PrettierFormatter implements IFormatter {
  readonly metadata: FormatterMetadata = {
    id: "prettier",
    name: "Prettier",
    description: "Opinionated code formatter for JS/TS/JSON/CSS/HTML/Markdown/Dockerfile",
    languages: [
      "javascript",
      "typescript",
      "json",
      "css",
      "scss",
      "less",
      "html",
      "markdown",
      "dockerfile",
    ],
    capabilities: {
      isFormatter: true,
      isOpinionated: true,
      tolerant: false,
    },
  };

  async format(
    code: string,
    language: string,
    settings?: FormatterSettings,
  ): Promise<FormatResult> {
    try {
      const [prettierModule, plugins] = await Promise.all([
        loadPrettier(),
        loadPluginsForLanguage(language),
      ]);

      if (plugins.length === 0 && !BUILTIN_PARSERS.has(language.toLowerCase())) {
        return {
          success: false,
          code,
          error: `No plugins for language: ${language}`,
        };
      }

      const formatted = await prettierModule.format(code, {
        parser: this.getParser(language),
        plugins,
        tabWidth: settings?.indentSize ?? 2,
        useTabs: settings?.useTabs ?? false,
        singleQuote: settings?.singleQuote ?? true,
        trailingComma: settings?.trailingComma ?? "es5",
        semi: settings?.semi ?? true,
      });

      return { success: true, code: formatted };
    } catch (error) {
      return {
        success: false,
        code,
        error:
          error instanceof Error ? error.message : "Prettier formatting failed",
      };
    }
  }

  private getParser(language: string): string {
    const parsers: Record<string, string> = {
      javascript: "babel",
      typescript: "typescript",
      json: "json",
      css: "css",
      scss: "scss",
      less: "less",
      html: "html",
      markdown: "markdown",
      dockerfile: "dockerfile",
    };
    return parsers[language.toLowerCase()] || "babel";
  }

  isAvailable(): boolean {
    return true;
  }
}
