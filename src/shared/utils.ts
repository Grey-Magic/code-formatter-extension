import { LANGUAGES_BY_EXTENSION } from "./constants";

const CODE_EXTENSION_LIST = Object.keys(LANGUAGES_BY_EXTENSION).join("|");
export const CODE_EXTENSIONS_RE = new RegExp(`\\.(${CODE_EXTENSION_LIST})$`, "i");

export function countNewlines(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) === 10) n++;
  }
  return n + (s.length > 0 && s.charCodeAt(s.length - 1) !== 10 ? 1 : 0);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);
  };
}

export class LRUMap<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value!);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

const CODE_EXTENSIONS =
  /\.(js|jsx|ts|tsx|mjs|cjs|json|py|pyi|go|rs|sql|html|htm|xml|css|scss|less|md|yml|yaml|toml|rb|lua|zig|dart)$/i;

const SPECIAL_FILENAMES: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "makefile",
  "docker-compose": "yaml",
  ".eslintrc": "json",
  ".prettierrc": "json",
  ".babelrc": "json",
  ".htaccess": "apache",
  ".env": "dotenv",
  ".gitignore": "gitignore",
};

export function detectLanguageFromUrl(): string | null {
  const url = window.location.href;
  const match = url.match(CODE_EXTENSIONS);

  if (match) {
    const ext = match[1].toLowerCase();
    return LANGUAGES_BY_EXTENSION[ext] || null;
  }

  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getLanguageFromFilename(filename: string): string | null {
  if (!filename || typeof filename !== "string") {
    return null;
  }

  const baseName = filename.split("/").pop() || filename;

  const lowerBase = baseName.toLowerCase();
  if (SPECIAL_FILENAMES[lowerBase]) {
    return SPECIAL_FILENAMES[lowerBase];
  }

  // Handle Dockerfile.* variants (e.g., Dockerfile.prod, Dockerfile.staging)
  if (lowerBase.startsWith("dockerfile")) {
    return "dockerfile";
  }

  // Handle .env.* variants (e.g., .env.production)
  if (lowerBase.startsWith(".env")) {
    return "dotenv";
  }

  // Handle compose files without extension
  if (lowerBase === "docker-compose" || lowerBase === "compose") {
    return "yaml";
  }

  const parts = filename.split(".");
  if (parts.length < 2) {
    return null;
  }

  const ext = parts.pop()?.toLowerCase();
  if (!ext) return null;

  const secondLastPart =
    parts.length > 0 ? parts[parts.length - 1].toLowerCase() : "";

  if (ext === "ts" && secondLastPart === "d") {
    return "typescript";
  }

  return LANGUAGES_BY_EXTENSION[ext] || null;
}

/**
 * Normalize a user-entered ignore pattern: lowercase, trimmed, no scheme,
 * path or trailing slash. Returns null for empty/invalid input.
 */
export function normalizeSitePattern(pattern: string): string | null {
  let p = (pattern || "").trim().toLowerCase();
  if (!p) return null;

  // Strip scheme and leading slashes from pasted URLs
  p = p.replace(/^https?:\/\//, "").replace(/^\/+/, "");
  // Keep only the host portion (drop path/query/hash)
  const hostEnd = /[/?#]/.exec(p);
  if (hostEnd) p = p.slice(0, hostEnd.index);
  if (p.endsWith("/")) p = p.slice(0, -1);

  return p || null;
}

/**
 * Check whether a hostname matches any ignore pattern.
 * Patterns are hosts, optionally with a "*." wildcard prefix matching
 * subdomains at any depth. Exact matches and parent-domain wildcards win;
 * a bare domain pattern does NOT match its subdomains unless wildcarded.
 */
export function isSiteIgnored(hostname: string, patterns: string[]): boolean {
  if (!hostname || !patterns?.length) return false;

  const host = hostname.trim().toLowerCase();

  return patterns.some((raw) => {
    const pattern = normalizeSitePattern(raw);
    if (!pattern) return false;

    if (pattern.startsWith("*.")) {
      const base = pattern.slice(2);
      return (
        base !== "" &&
        (host === base || (host.endsWith("." + base) && host !== base))
      );
    }
    return host === pattern;
  });
}
