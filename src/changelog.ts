/**
 * Changelog Display Module
 *
 * This module renders the extension changelog dynamically into the DOM.
 * It includes HTML sanitization to prevent XSS attacks while allowing
 * safe HTML formatting in changelog items.
 */

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Represents a single change entry with a category type and list of items
 */
interface ChangeEntry {
  /** The category of changes (e.g., "New Features", "Fixed", "Improved") */
  type: string;
  /** Array of HTML-formatted change descriptions */
  items: string[];
}

/**
 * Represents the complete changelog data structure
 */
interface ChangelogData {
  /** Semantic version number */
  version: string;
  /** Release date in YYYY-MM-DD format */
  date: string;
  /** Array of categorized changes */
  changes: ChangeEntry[];
}

// ============================================================================
// Changelog Data
// ============================================================================

/**
 * The changelog data containing version information and categorized changes
 */
const changelogData: ChangelogData = {
  version: "1.9.6",
  date: "2026-07-29",
  changes: [
    {
      type: "New",
      items: [
        "<strong>Format on Save</strong>: Press Ctrl+S / Cmd+S to format the current code block.",
        "<strong>Batch Format All</strong>: Press Ctrl+Shift+B to format all code blocks on the page at once.",
        "<strong>Format Selection</strong>: Highlight code and format just that section.",
        "<strong>Biome Formatter</strong>: Added Biome as an alternative formatter for JavaScript, TypeScript, JSON, and CSS (WASM-based).",
        "<strong>Formatter Selector</strong>: Choose your preferred formatter (Prettier, js-beautify, or Biome) per language in Settings.",
        "<strong>Print Formatted Code</strong>: New Print button in the toolbar to print formatted code with a clean layout.",
        "<strong>Extension Icon</strong>: Click the extension icon to open Settings.",
        "<strong>Dockerfile Support</strong>: Auto-detects and formats Dockerfiles.",
        "<strong>Makefile Support</strong>: Auto-detects and formats Makefiles.",
        "<strong>.env Support</strong>: Auto-detects .env files.",
        "<strong>Context Menu</strong>: Right-click to select language for formatting (Dockerfile, Makefile, and more).",
      ],
    },
    {
      type: "Improved",
      items: [
        "<strong>Language Detection</strong>: Enhanced auto-detection handles special filenames (Dockerfile, Makefile, .env, .eslintrc, .babelrc, .htaccess, .gitignore, docker-compose).",
        "<strong>Theme Dropdown</strong>: All 10 editor themes now appear in the toolbar dropdown (was missing 6 themes).",
        "<strong>Word Wrap</strong>: Word wrap toggle now works correctly. Setting persists and applies in real time.",
        "<strong>Modular Architecture</strong>: Refactored into separate modules for editor, toolbar, status bar, detection, formatting, and search.",
        "<strong>Test Coverage</strong>: Fixed pre-existing test failures. 104 tests passing.",
      ],
    },
    {
      type: "Fixed",
      items: [
        "<strong>Duplicate Null Check</strong>: Removed redundant null check in background message handler.",
        "<strong>Redundant parentElement</strong>: Fixed duplicate parentElement access in code block detection.",
        "<strong>Wrap Status Display</strong>: Removed wrap status from status bar (was always showing 'off' regardless of setting).",
        "<strong>Theme Dropdown</strong>: Fixed missing themes in the options page dropdown.",
        "<strong>TypeScript Config</strong>: Restored missing tsconfig.json to unblock tests and type checking.",
      ],
    },
  ],
};

// ============================================================================
// HTML Sanitization
// ============================================================================

/**
 * Whitelist of allowed HTML tags for sanitization
 * These tags are considered safe and will not be removed
 */
const ALLOWED_TAGS: string[] = [
  "strong",
  "b",
  "i",
  "em",
  "u",
  "br",
  "span",
  "code",
];

/**
 * Sanitizes HTML content by removing potentially dangerous tags
 * while preserving allowed formatting tags
 *
 * @param html - The HTML string to sanitize
 * @returns A DocumentFragment containing the sanitized content
 */
function sanitizeHtml(html: string): DocumentFragment {
  // Parse the HTML string into a DOM document
  const parser: DOMParser = new DOMParser();
  const doc: Document = parser.parseFromString(html, "text/html");

  // Create a tree walker to iterate through all elements in the document body
  const treeWalker: TreeWalker = document.createTreeWalker(
    doc.body,
    NodeFilter.SHOW_ELEMENT,
  );

  // Collect all elements that are not in the allowed tags list
  const elementsToRemove: Element[] = [];
  let currentNode: Node | null;

  while ((currentNode = treeWalker.nextNode()) !== null) {
    const element: Element = currentNode as Element;
    if (!ALLOWED_TAGS.includes(element.tagName.toLowerCase())) {
      elementsToRemove.push(element);
    }
  }

  // Remove all disallowed elements from their parent nodes
  elementsToRemove.forEach((element: Element): void => {
    element.parentNode?.removeChild(element);
  });

  // Remove dangerous attributes from all remaining elements
  const dangerousAttrs = [
    "onclick",
    "onerror",
    "onload",
    "onmouseover",
    "onfocus",
    "onblur",
    "onchange",
    "onsubmit",
    "href",
    "src",
    "xlink:href",
  ];

  const allElements = doc.body.querySelectorAll("*");
  allElements.forEach((el: Element) => {
    // Remove all event handlers and dangerous attributes
    dangerousAttrs.forEach((attr) => {
      el.removeAttribute(attr);
    });
    // Also remove any attribute starting with 'on'
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith("on")) {
        el.removeAttribute(attr.name);
      }
    });
  });

  // Create a new document fragment to hold the sanitized content
  const fragment: DocumentFragment = document.createDocumentFragment();

  // Move all remaining child nodes from the parsed document to the fragment
  Array.from(doc.body.childNodes).forEach((node: Node): void => {
    fragment.appendChild(node);
  });

  return fragment;
}

// ============================================================================
// DOM Rendering
// ============================================================================

/**
 * Creates the header section with title and version badge
 *
 * @returns A DocumentFragment containing the header elements
 */
function createHeader(): DocumentFragment {
  const fragment: DocumentFragment = document.createDocumentFragment();

  // Create main title
  const title: HTMLHeadingElement = document.createElement("h1");
  title.textContent = "Code Formatter";

  // Create version badge
  const versionBadge: HTMLSpanElement = document.createElement("span");
  versionBadge.className = "version-badge";
  versionBadge.textContent = `v${changelogData.version}`;

  title.appendChild(versionBadge);
  fragment.appendChild(title);

  // Create release date paragraph
  const dateParagraph: HTMLParagraphElement = document.createElement("p");
  dateParagraph.style.cssText = "color: #ccc; margin-bottom: 30px;";
  dateParagraph.textContent = `Released: ${changelogData.date}`;
  fragment.appendChild(dateParagraph);

  return fragment;
}

/**
 * Creates a section for a single change category
 *
 * @param entry - The change entry to render
 * @param index - The index for animation delay calculation
 * @returns A div element containing the section
 */
function createChangeSection(
  entry: ChangeEntry,
  index: number,
): HTMLDivElement {
  const section: HTMLDivElement = document.createElement("div");
  section.className = "section";
  section.style.animationDelay = `${index * 0.1}s`;

  // Create section heading
  const heading: HTMLHeadingElement = document.createElement("h2");
  heading.textContent = entry.type;
  section.appendChild(heading);

  // Create list of changes
  const list: HTMLUListElement = document.createElement("ul");

  entry.items.forEach((item: string): void => {
    const listItem: HTMLLIElement = document.createElement("li");
    listItem.appendChild(sanitizeHtml(item));
    list.appendChild(listItem);
  });

  section.appendChild(list);

  return section;
}

/**
 * Creates the footer section with thanks message and close button
 *
 * @returns A div element containing the footer
 */
function createFooter(): HTMLDivElement {
  const footer: HTMLDivElement = document.createElement("div");
  footer.className = "footer";

  // Create thanks message
  const thanksMessage: HTMLParagraphElement = document.createElement("p");
  thanksMessage.textContent = "Thanks for using Code Formatter!";
  footer.appendChild(thanksMessage);

  // Create close button (using button element for better accessibility)
  const closeButton: HTMLButtonElement = document.createElement("button");
  closeButton.type = "button";
  closeButton.id = "close-btn";
  closeButton.className = "btn";
  closeButton.textContent = "Close";
  footer.appendChild(closeButton);

  return footer;
}

/**
 * Renders the complete changelog into the specified container
 *
 * @param container - The HTML element to render the changelog into
 */
function renderChangelog(container: HTMLElement): void {
  const fragment: DocumentFragment = document.createDocumentFragment();

  // Add header section
  fragment.appendChild(createHeader());

  // Add each change section with staggered animation
  changelogData.changes.forEach((entry: ChangeEntry, index: number): void => {
    fragment.appendChild(createChangeSection(entry, index));
  });

  // Add footer section
  fragment.appendChild(createFooter());

  // Append everything to the container
  container.appendChild(fragment);

  // Add event listener to close button
  const closeButton: HTMLElement | null = document.getElementById("close-btn");
  closeButton?.addEventListener("click", (): void => {
    window.close();
  });
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize changelog when DOM is fully loaded
 */
document.addEventListener("DOMContentLoaded", (): void => {
  const container: HTMLElement | null = document.getElementById(
    "changelog-container",
  );

  if (!container) {
    console.error("Changelog container not found");
    return;
  }

  renderChangelog(container);

  // Mark version as seen after user views changelog
  const currentVersion = (chrome as any).runtime?.getManifest()?.version;
  if (currentVersion) {
    chrome.storage.local.set({ lastSeenVersion: currentVersion }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Changelog] Failed to mark version as seen:",
          chrome.runtime.lastError.message,
        );
      } else {
        console.log(`[Changelog] Marked version ${currentVersion} as seen`);
      }
    });
  }
});
