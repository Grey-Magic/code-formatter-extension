/**
 * WASM Loader for browser extensions
 * Handles loading and initializing WASM formatters in Chrome/Firefox extension context
 * Includes error boundaries and fallback support
 */

// Chrome types are provided by @types/chrome package

// Interface for WASM module exports
interface WasmModule {
  initAsync(url?: string | URL | Request): Promise<unknown>;
  format(code: string, ...args: unknown[]): string;
}

// Cache for initialized WASM modules
const wasmCache = new Map<string, WasmModule>();
const wasmLoadPromises = new Map<string, Promise<WasmModule>>();

/**
 * Get the base URL for WASM files in the extension
 */
function getWasmBaseUrl(): string {
  if (typeof chrome !== "undefined" && chrome.runtime) {
    return chrome.runtime.getURL("wasm/");
  }
  return "/wasm/";
}

/**
 * Check if WASM is supported in the current browser
 */
export function isWasmSupported(): boolean {
  try {
    return (
      typeof WebAssembly !== "undefined" &&
      WebAssembly.instantiateStreaming !== undefined
    );
  } catch {
    return false;
  }
}

/**
 * Load and initialize a WASM formatter module
 *
 * @param webJsFile - The web JS wrapper filename (e.g., 'ruff_fmt_web.js')
 * @param wasmFile - WASM binary filename (e.g., 'ruff_fmt_bg.wasm')
 * @returns Initialized module with format function
 */
export async function loadWasmFormatter(
  webJsFile: string,
  wasmFile: string,
): Promise<WasmModule> {
  const cacheKey = `${webJsFile}:${wasmFile}`;

  if (wasmCache.has(cacheKey)) {
    return wasmCache.get(cacheKey)!;
  }

  if (wasmLoadPromises.has(cacheKey)) {
    return wasmLoadPromises.get(cacheKey)!;
  }

  const loadPromise = (async () => {
    if (!isWasmSupported()) {
      const error = new Error("WebAssembly is not supported in this browser");
      console.warn("[WASM Loader] WebAssembly not supported:", webJsFile);
      throw error;
    }

    try {
      const baseUrl = getWasmBaseUrl();
      const webJsUrl = `${baseUrl}${webJsFile}`;
      const wasmUrl = `${baseUrl}${wasmFile}`;

      const module: any = await import(/* @vite-ignore */ webJsUrl);

      if (typeof module.initAsync === "function") {
        await module.initAsync(wasmUrl);
      } else if (typeof module.default === "function") {
        await module.default(wasmUrl);
      } else if (typeof module.initSync === "function") {
        const response = await fetch(wasmUrl);
        const buffer = await response.arrayBuffer();
        module.initSync(buffer);
      } else if (module.format) {
        console.log(
          `[WASM Loader] ${webJsFile} doesn't require initialization`,
        );
      } else {
        throw new Error(
          `WASM module ${webJsFile} has no known initialization method`,
        );
      }

      wasmCache.set(cacheKey, module);
      console.log(`[WASM Loader] Successfully loaded ${webJsFile}`);
      return module;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(`[WASM Loader] Failed to load ${webJsFile}:`, error);
      throw new Error(
        `WASM formatter '${webJsFile}' failed to load. ` +
          `This may be due to CSP restrictions or missing files. ` +
          `Check that wasm/${wasmFile} exists and CSP allows 'wasm-unsafe-eval'. ` +
          `Error: ${errorMessage}`,
      );
    } finally {
      wasmLoadPromises.delete(cacheKey);
    }
  })();

  wasmLoadPromises.set(cacheKey, loadPromise);
  return loadPromise;
}

/**
 * Clear the WASM module cache
 */
export function clearWasmCache(): void {
  wasmCache.clear();
  console.log("[WASM Loader] Cache cleared");
}
