/**
 * Shared C-like code scanner.
 *
 * Splits JS/TS/CSS-style source into typed segments (strings, template
 * literals, comments, regex literals, plain code). Used by minification
 * (safe comment stripping) and editor diagnostics (bracket balance).
 */

export type SegmentType = "code" | "string" | "template" | "comment" | "regex";

export interface CodeSegment {
  type: SegmentType;
  start: number;
  end: number;
}

export interface ScanOptions {
  /** Treat `/` as a regex-literal delimiter using a preceding-token heuristic */
  regexLiterals?: boolean;
}

const REGEX_PRECEDING =
  /(?:^|[({[,;:!&|?+\-*%<>=~^]|return|typeof|instanceof|in|of|new|delete|void|case|do|else|yield|await)$/;

const isWordChar = (ch: string): boolean => {
  const c = ch.charCodeAt(0);
  return (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
};

const isSpace = (ch: string): boolean => {
  const c = ch.charCodeAt(0);
  return c === 9 || c === 10 || c === 13 || c === 32;
};

const regexAllowed = (prevWord: string, prevChar: string): boolean =>
  prevWord ? REGEX_PRECEDING.test(prevWord) : REGEX_PRECEDING.test(prevChar);

/**
 * Scan source into ordered segments covering [0, code.length).
 * Template literals are scanned with a mode stack so nested `${ ... }`
 * expressions (including object literals and nested templates) are handled.
 */
export function scanSegments(code: string, options: ScanOptions = {}): CodeSegment[] {
  const allowRegex = options.regexLiterals ?? true;
  const segments: CodeSegment[] = [];
  let i = 0;
  let prevWord = "";
  let prevChar = "";

  // Stack entries: "tpl" = template-text level, number = `${ ... }` expression
  // brace depth. Empty stack means we are in top-level code.
  let tplStack: ("tpl" | number)[] = [];

  let segStart = 0;
  let segType: SegmentType = "code";

  const closeSegment = (to: number): void => {
    if (to > segStart) segments.push({ type: segType, start: segStart, end: to });
    segStart = to;
  };

  const openSegment = (type: SegmentType, at: number): void => {
    closeSegment(at);
    segType = type;
    segStart = at;
  };

  const topIsText = (): boolean =>
    tplStack.length > 0 && tplStack[tplStack.length - 1] === "tpl";

  while (i < code.length) {
    const ch = code[i];

    // -------- Template text mode ----------------------------------------
    if (topIsText()) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "$" && code[i + 1] === "{") {
        // Include `${` in the surrounding template segment
        closeSegment(i + 2);
        segType = "code";
        segStart = i + 2;
        tplStack.push(0);
        i += 2;
        continue;
      }
      if (ch === "`") {
        // Include the closing backtick in the template segment
        closeSegment(i + 1);
        i++;
        tplStack.pop();
        segType = "code";
        segStart = i;
        continue;
      }
      i++;
      continue;
    }

    // -------- Expression-in-${...} mode ----------------------------------
    if (tplStack.length > 0) {
      // End of ${...} (only when brace depth is zero)
      if (ch === "}") {
        const depth = tplStack[tplStack.length - 1] as number;
        if (depth > 0) {
          tplStack[tplStack.length - 1] = depth - 1;
          prevChar = "}";
          i++;
          continue;
        }
        // Include the closing `}` in the surrounding template segment
        closeSegment(i);
        segType = "template";
        segStart = i;
        i++;
        tplStack.pop();
        continue;
      }

      if (ch === "{") {
        const depth = tplStack[tplStack.length - 1] as number;
        tplStack[tplStack.length - 1] = depth + 1;
        prevChar = "{";
        i++;
        continue;
      }

      // Nested template inside expression
      if (ch === "`") {
        // Backtick belongs to the new template segment
        closeSegment(i);
        i++;
        tplStack.push("tpl");
        segType = "template";
        segStart = i - 1;
        continue;
      }

      // Strings inside expression
      if (ch === '"' || ch === "'") {
        const quote = ch;
        const start = i;
        i++;
        while (i < code.length && code[i] !== quote && code[i] !== "\n") {
          i += code[i] === "\\" ? 2 : 1;
        }
        i = Math.min(i + 1, code.length);
        closeSegment(start);
        segments.push({ type: "string", start, end: i });
        segStart = i;
        prevWord = "";
        prevChar = '"';
        continue;
      }

      // Comments inside expression
      if (ch === "/" && code[i + 1] === "/") {
        const start = i;
        while (i < code.length && code[i] !== "\n") i++;
        closeSegment(start);
        segments.push({ type: "comment", start, end: i });
        segStart = i;
        continue;
      }
      if (ch === "/" && code[i + 1] === "*") {
        const start = i;
        i += 2;
        while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) i++;
        i = Math.min(i + 2, code.length);
        closeSegment(start);
        segments.push({ type: "comment", start, end: i });
        segStart = i;
        continue;
      }
    }

    // -------- Plain code (top level) ------------------------------------

    if (ch === "/" && code[i + 1] === "/") {
      const start = i;
      while (i < code.length && code[i] !== "\n") i++;
      closeSegment(start);
      segments.push({ type: "comment", start, end: i });
      segStart = i;
      continue;
    }

    if (ch === "/" && code[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) i++;
      i = Math.min(i + 2, code.length);
      closeSegment(start);
      segments.push({ type: "comment", start, end: i });
      segStart = i;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      while (i < code.length && code[i] !== quote && code[i] !== "\n") {
        i += code[i] === "\\" ? 2 : 1;
      }
      i = Math.min(i + 1, code.length);
      closeSegment(start);
      segments.push({ type: "string", start, end: i });
      segStart = i;
      prevWord = "";
      prevChar = '"';
      continue;
    }

    // Enter template-literal text mode from plain code
    if (ch === "`") {
      // Include the opening backtick in the template segment
      closeSegment(i);
      segStart = i;
      segType = "template";
      i++;
      tplStack.push("tpl");
      continue;
    }

    if (allowRegex && ch === "/" && regexAllowed(prevWord, prevChar)) {
      const start = i;
      i++;
      let inClass = false;
      let closed = false;
      while (i < code.length) {
        const c = code[i];
        if (c === "\\") {
          i += 2;
          continue;
        }
        if (c === "\n") break;
        if (c === "[") inClass = true;
        else if (c === "]") inClass = false;
        else if (c === "/" && !inClass) {
          i++;
          closed = true;
          break;
        }
        i++;
      }
      if (closed) {
        while (i < code.length && /[a-z]/i.test(code[i])) i++;
        closeSegment(start);
        segments.push({ type: "regex", start, end: i });
        segStart = i;
        prevWord = "";
        prevChar = '"';
        continue;
      }
      i = start + 1;
    }

    if (isWordChar(ch)) {
      prevWord = isWordChar(prevChar) ? prevWord + ch : ch;
    } else if (!isSpace(ch)) {
      prevWord = "";
      prevChar = ch;
    }

    i++;
  }

  closeSegment(i);
  return segments;
}

/**
 * Return source with comments removed. Comments that span a newline keep
 * exactly one newline so automatic semicolon insertion semantics are
 * preserved. Comments without newlines collapse to a single space and
 * surrounding trailing whitespace is trimmed.
 */
export function stripComments(code: string, options: ScanOptions = {}): string {
  const segments = scanSegments(code, options);
  const chunks: string[] = [];
  let cursor = 0;

  for (const seg of segments) {
    if (seg.type !== "comment") continue;
    const preceding = code.slice(cursor, seg.start);
    chunks.push(preceding.replace(/\s+$/, ""));
    const literal = code.slice(seg.start, seg.end);
    chunks.push(literal.includes("\n") ? "\n" : " ");
    cursor = seg.end;
  }
  chunks.push(code.slice(cursor));
  return chunks.join("");
}

export interface UnbalancedBracket {
  char: string;
  offset: number;
  kind: "unclosed" | "unexpected";
}

/**
 * Find the first unbalanced (), [] or {} bracket in C-like code.
 * Strings, comments and template literals are skipped wholesale, so any
 * bracket characters inside them cannot produce false positives and
 * brackets inside `${ ... }` expressions are still inspected (those are
 * emitted as a single code segment).
 */
export function findUnbalancedBracket(
  code: string,
  options: ScanOptions = {},
): UnbalancedBracket | null {
  const opaque: CodeSegment[] = scanSegments(code, options)
    .filter((s) => s.type !== "code")
    .sort((a, b) => a.start - b.start);
  let segIdx = 0;

  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const stack: { char: string; offset: number }[] = [];

  for (let i = 0; i < code.length; i++) {
    while (segIdx < opaque.length && opaque[segIdx].end <= i) segIdx++;
    const seg = opaque[segIdx];
    if (seg && i >= seg.start) {
      i = seg.end - 1;
      continue;
    }

    const ch = code[i];
    if (ch === "(" || ch === "[" || ch === "{") {
      stack.push({ char: ch, offset: i });
    } else if (ch === ")" || ch === "]" || ch === "}") {
      const open = stack.pop();
      if (!open || open.char !== pairs[ch]) {
        return { char: ch, offset: i, kind: "unexpected" };
      }
    }
  }

  return stack.length > 0
    ? {
        char: stack[stack.length - 1].char,
        offset: stack[stack.length - 1].offset,
        kind: "unclosed",
      }
    : null;
}