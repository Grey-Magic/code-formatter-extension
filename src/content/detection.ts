import { EXTENSION_MAP } from "../shared/constants";
import { detectLanguageFromUrl, getLanguageFromFilename } from "../shared/utils";
import type { LanguagePattern, DetectionResult } from "./types";

const MIN_CONTENT_LENGTH = 50;
const MIN_TOTAL_CONTENT_LENGTH = 200;
const SUBSTANTIAL_CONTENT_LENGTH = 100;
const MAX_DETECTION_CONTENT_SIZE = 50000;

const DETECTION_PATTERNS: LanguagePattern[] = [
  { lang: "html", regex: /^\s*<!DOCTYPE|<html|<head|<body/i, weight: 10 },
  { lang: "xml", regex: /^\s*<\?xml/i, weight: 10 },
  {
    lang: "css",
    regex: /\b(?:body|html|div|span|[\w-][\w-]*)\s*\{[^\n]{0,500}\}/,
    weight: 8,
  },
  {
    lang: "typescript",
    regex: /\b(?:interface|type|enum|namespace|declare|readonly)\s+\w+/,
    weight: 6,
  },
  {
    lang: "javascript",
    regex:
      /\b(?:const|let|var|function|class|return|if|else|for|import|export|async|await)\b/,
    weight: 3,
  },
  {
    lang: "python",
    regex:
      /\b(?:def\s|class\s|elif\s|import\s+\w+|from\s+\w+\s+import|lambda\s|yield\b)/,
    weight: 5,
  },
  {
    lang: "go",
    regex: /\b(?:func\s|package\s|import\s|defer\b|goroutine|chan\b|select\b)/,
    weight: 6,
  },
  {
    lang: "rust",
    regex:
      /\b(?:fn\s|let\s+mut|impl\s|pub\s+fn|struct\s|enum\s|match\b|use\s+\w+::|trait\s)/,
    weight: 6,
  },
  {
    lang: "sql",
    regex:
      /\b(?:SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE|ALTER\s+TABLE|DROP|JOIN|WHERE|FROM)\b/i,
    weight: 6,
  },
  { lang: "yaml", regex: /^[a-zA-Z_][a-zA-Z0-9_-]*\s*:/m, weight: 3 },
  {
    lang: "ruby",
    regex:
      /\b(?:require\s|puts\s|def\s|end\b|class\s|module\s|attr_accessor|do\s*\|)/,
    weight: 5,
  },
  { lang: "toml", regex: /^\s*[a-zA-Z_][a-zA-Z0-9_-]*\s*=\s*/, weight: 3 },
  {
    lang: "php",
    regex: /<\?php|\$[\w]+\s*=|function\s+\w+\s*\(|echo\s+|public\s+function/,
    weight: 5,
  },
  {
    lang: "java",
    regex:
      /\b(?:public\s+(?:class|static|void)|private\s+|System\.out\.print|import\s+java\.|extends\s+\w+|implements\s+)/,
    weight: 5,
  },
  {
    lang: "c",
    regex:
      /#include\s*[<"]|int\s+main\s*\(|printf\s*\(|malloc\s*\(|void\s+\w+\s*\(/,
    weight: 4,
  },
  {
    lang: "cpp",
    regex:
      /#include\s*<iostream>|std::|cout\s*<<|cin\s*>>|nullptr|template\s*</,
    weight: 5,
  },
  {
    lang: "csharp",
    regex:
      /\b(?:using\s+System|namespace\s+\w+|public\s+class|Console\.Write|async\s+Task|var\s+\w+\s*=)/,
    weight: 5,
  },
  {
    lang: "swift",
    regex:
      /\b(?:func\s+\w+\s*\(|var\s+\w+\s*:|let\s+\w+\s*:|import\s+Foundation|struct\s+\w+|class\s+\w+:)/,
    weight: 5,
  },
  {
    lang: "kotlin",
    regex:
      /\b(?:fun\s+\w+\s*\(|val\s+\w+\s*:|var\s+\w+\s*:|data\s+class|companion\s+object|import\s+kotlin)/,
    weight: 5,
  },
  {
    lang: "scala",
    regex:
      /\b(?:def\s+\w+\s*\(|val\s+\w+\s*=|class\s+\w+\s+|object\s+\w+|import\s+scala)/,
    weight: 5,
  },
  {
    lang: "r",
    regex:
      /\b(?:<-|\bfunction\s*\(|library\(|ggplot|require\(|install\.packages)/,
    weight: 4,
  },
  {
    lang: "dart",
    regex:
      /\b(?:void\s+main\s*\(|class\s+\w+\s+|final\s+|Widget\s+|@override|import\s+'package:flutter)/,
    weight: 5,
  },
  {
    lang: "bash",
    regex:
      /^#!\/bin\/(bash|sh|zsh)|\$\{?\w+\}?|echo\s+|if\s+\[\[|for\s+\w+\s+in/,
    weight: 4,
  },
  {
    lang: "markdown",
    regex: /^#{1,6}\s+\w+|^\*\*\w+\*\*|^\[.+\]\(.+\)|^```\w*/m,
    weight: 3,
  },
];

const LANGUAGE_SELECTORS = [
  'pre[class*="language-"]',
  'code[class*="language-"]',
  'pre[class*="lang-"]',
  'code[class*="lang-"]',
];

const SHEBANG_PATTERN = /^#!.*\/(bash|python|ruby|node|perl|php|sh|zsh|fish)/;

export function detectLanguage(content: string): string | null {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        return "json";
      }
    } catch {
      /* not JSON */
    }
  }

  const pathname = window.location.pathname;
  const segments = pathname.split("/").filter(Boolean);

  // Check the full path for filenames like Dockerfile, Makefile, .env
  const pathnameLang = getLanguageFromFilename(pathname);
  if (pathnameLang && EXTENSION_MAP[pathnameLang]) {
    return pathnameLang;
  }

  // Check each path segment for special filenames
  for (const segment of segments) {
    const segmentLang = getLanguageFromFilename(segment);
    if (segmentLang) {
      return segmentLang;
    }
  }

  const lastSegment = segments.pop() || "";
  const ext = lastSegment.split(".").pop()?.split("?")[0].toLowerCase();
  if (ext && ext !== lastSegment && EXTENSION_MAP[ext]) {
    return EXTENSION_MAP[ext];
  }

  const langMatches: Record<string, number> = {};
  const matchDetails: Record<string, string[]> = {};

  for (const p of DETECTION_PATTERNS) {
    if (p.regex.test(content)) {
      langMatches[p.lang] = (langMatches[p.lang] || 0) + p.weight;
      if (!matchDetails[p.lang]) matchDetails[p.lang] = [];
      matchDetails[p.lang].push(p.regex.source.substring(0, 30));
    }
  }

  let bestMatch: { lang: string; weight: number } | null = null;
  for (const [lang, weight] of Object.entries(langMatches)) {
    const patternCount = matchDetails[lang].length;
    if (patternCount >= 2 || weight >= 8) {
      if (!bestMatch || weight > bestMatch.weight) {
        bestMatch = { lang, weight };
      }
    }
  }

  return bestMatch?.lang ?? null;
}

export function detectLanguageWithConfidence(content: string): DetectionResult {
  const lang = detectLanguage(content);
  return {
    language: lang,
    confidence: lang ? 1 : 0,
    patterns: [],
  };
}

export function appearsToBeCodePage(): boolean {
  for (const selector of LANGUAGE_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.textContent?.trim() || "";
      if (text.length > SUBSTANTIAL_CONTENT_LENGTH) {
        return true;
      }
    }
  }

  const urlLang = detectLanguageFromUrl();
  if (urlLang) return true;

  const preElements = Array.from(document.querySelectorAll("pre"));
  const codeElements = Array.from(document.querySelectorAll("pre code, code"));

  const codeTextParts: string[] = [];
  let hasShebang = false;

  for (const pre of preElements) {
    const text = pre.textContent?.trim() || "";
    if (text.length > MIN_CONTENT_LENGTH) {
      if (!hasShebang && SHEBANG_PATTERN.test(text)) {
        hasShebang = true;
      }
      codeTextParts.push(text);
    }
  }

  for (const code of codeElements) {
    if (code.closest("pre")) continue;
    const text = code.textContent?.trim() || "";
    if (text.length > MIN_CONTENT_LENGTH) {
      if (!hasShebang && SHEBANG_PATTERN.test(text)) {
        hasShebang = true;
      }
      codeTextParts.push(text);
    }
  }

  if (hasShebang) return true;

  const allCodeText = codeTextParts.join("\n");
  if (allCodeText.length < MIN_TOTAL_CONTENT_LENGTH) {
    return false;
  }

  const detectedLang = detectLanguage(allCodeText);
  return detectedLang !== null;
}

export function getLimitedContent(content: string): string {
  if (content.length > MAX_DETECTION_CONTENT_SIZE) {
    return content.substring(0, MAX_DETECTION_CONTENT_SIZE);
  }
  return content;
}

export { DETECTION_PATTERNS, LANGUAGE_SELECTORS, SHEBANG_PATTERN };
