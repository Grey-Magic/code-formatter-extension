import { LANGUAGES_BY_EXTENSION } from "./constants";

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

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (...args: Parameters<T>): void {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
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

export function detectLanguageFromUrl(): string | null {
  const url = window.location.href;

  const codeExtensions =
    /\.(js|jsx|ts|tsx|mjs|cjs|json|py|pyi|go|rs|sql|html|htm|xml|css|scss|less|md|yml|yaml|toml|rb|lua|zig|dart)$/i;
  const match = url.match(codeExtensions);

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

export { LANGUAGES_BY_EXTENSION as EXTENSION_TO_LANGUAGE_MAP };

export function getLanguageFromFilename(filename: string): string | null {
  if (!filename || typeof filename !== "string") {
    return null;
  }

  const baseName = filename.split("/").pop() || filename;

  // Handle special filenames without extensions
  const specialFilenames: Record<string, string> = {
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

  const lowerBase = baseName.toLowerCase();
  if (specialFilenames[lowerBase]) {
    return specialFilenames[lowerBase];
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
