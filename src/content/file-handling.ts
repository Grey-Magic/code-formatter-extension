import { ELEMENT_IDS, CSS_CLASSES } from "../shared/constants";
import { loadFiles } from "../formatters/file-loader";

const ACCEPTED_FILE_EXTENSIONS =
  ".js,.jsx,.ts,.tsx,.json,.css,.scss,.less,.html,.htm,.xml,.md,.py,.go,.rs,.sql,.yml,.yaml,.toml,.rb,.lua,.zig,.dart,.txt,.Dockerfile,.dockerfile";

let fileInputElement: HTMLInputElement | null = null;
let dropZoneElement: HTMLElement | null = null;

type FileSelectionHandler = (
  code: string,
  language: string,
  fileInfo: { name: string; size: number },
) => Promise<void>;

let onFileSelected: FileSelectionHandler | null = null;

export function setFileSelectionHandler(handler: FileSelectionHandler): void {
  onFileSelected = handler;
}

export function insertTextAtCursor(
  input: HTMLTextAreaElement | HTMLInputElement,
  text: string,
): void {
  const start = input.selectionStart ?? 0;
  const end = input.selectionEnd ?? 0;
  const before = input.value.substring(0, start);
  const after = input.value.substring(end);

  input.value = before + text + after;
  input.selectionStart = input.selectionEnd = start + text.length;

  input.dispatchEvent(new Event("input", { bubbles: true }));
}

export function createFileInput(): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "file";
  input.id = ELEMENT_IDS.FILE_INPUT;
  input.multiple = true;
  input.accept = ACCEPTED_FILE_EXTENSIONS;
  input.style.display = "none";
  input.addEventListener("change", async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const filesArray = Array.from(target.files);
      await handleFileSelection(filesArray);
    }
  });
  fileInputElement = input;
  return input;
}

export async function handleFileSelection(files: File[]): Promise<void> {
  if (files.length === 0) return;

  const results = await loadFiles(files);
  const successfulLoads = results.filter((r) => r.success);

  if (successfulLoads.length === 0) {
    console.error("[Code Formatter] No files could be loaded");
    return;
  }

  const firstLoad = successfulLoads[0];

  if (
    firstLoad.code &&
    firstLoad.language &&
    firstLoad.fileInfo &&
    onFileSelected
  ) {
    await onFileSelected(
      firstLoad.code,
      firstLoad.language,
      firstLoad.fileInfo,
    );

    if (successfulLoads.length > 1) {
      console.log(
        `[Code Formatter] Loaded first of ${successfulLoads.length} files. Only one file can be displayed at a time.`,
      );
    }
  }
}

export function openFileDialog(): void {
  if (fileInputElement) {
    fileInputElement.click();
  }
}

function createDropZone(): HTMLElement {
  const zone = document.createElement("div");
  zone.id = ELEMENT_IDS.DROP_ZONE;
  zone.className = CSS_CLASSES.DROP_ZONE;
  const content = document.createElement("div");
  content.className = "code-formatter-drop-zone__content";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "64");
  svg.setAttribute("height", "64");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");

  const createPath = (d: string) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    return path;
  };

  const createPolyline = (points: string) => {
    const polyline = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "polyline",
    );
    polyline.setAttribute("points", points);
    return polyline;
  };

  const createLine = (x1: string, y1: string, x2: string, y2: string) => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    return line;
  };

  svg.appendChild(
    createPath("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"),
  );
  svg.appendChild(createPolyline("14 2 14 8 20 8"));
  svg.appendChild(createLine("12", "18", "12", "12"));
  svg.appendChild(createLine("9", "15", "12", "12"));
  svg.appendChild(createLine("15", "15", "12", "12"));

  const text = document.createElement("p");
  text.className = "code-formatter-drop-zone__text";
  text.textContent = "Drop files here or press ";

  const kbd = document.createElement("kbd");
  kbd.textContent = "Ctrl+O";
  text.appendChild(kbd);

  content.appendChild(svg);
  content.appendChild(text);
  zone.appendChild(content);

  zone.addEventListener("dragover", (e: DragEvent) => {
    e.preventDefault();
    zone.classList.add(CSS_CLASSES.DROP_ZONE_DRAGOVER);
  });

  zone.addEventListener("dragleave", () => {
    zone.classList.remove(CSS_CLASSES.DROP_ZONE_DRAGOVER);
  });

  zone.addEventListener("drop", async (e: DragEvent) => {
    e.preventDefault();
    zone.classList.remove(CSS_CLASSES.DROP_ZONE_DRAGOVER);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const filesArray = Array.from(files);
      await handleFileSelection(filesArray);
      hideDropZone();
    }
  });

  return zone;
}

export function showDropZone(): void {
  if (!dropZoneElement) {
    dropZoneElement = createDropZone();
    document.body.appendChild(dropZoneElement);
  }
  dropZoneElement.classList.add(CSS_CLASSES.DROP_ZONE_ACTIVE);
}

export function hideDropZone(): void {
  if (dropZoneElement) {
    dropZoneElement.classList.remove(CSS_CLASSES.DROP_ZONE_ACTIVE);
  }
}

export function setupDragDropZone(
  registerEventListener: (
    target: EventTarget,
    type: string,
    listener: EventListener,
  ) => void,
): void {
  if (!dropZoneElement) {
    dropZoneElement = createDropZone();
    document.body.appendChild(dropZoneElement);
  }

  registerEventListener(document, "dragover", ((_e: Event) => {
    const e = _e as DragEvent;
    const hasFiles = e.dataTransfer?.types.some((type) => type === "Files");
    if (hasFiles) {
      showDropZone();
    }
  }) as EventListener);

  registerEventListener(document, "dragleave", ((_e: Event) => {
    const e = _e as DragEvent;
    if (e.relatedTarget === null) {
      hideDropZone();
    }
  }) as EventListener);

  registerEventListener(document, "drop", (() => {
    hideDropZone();
  }) as EventListener);
}

export function getFileInputElement(): HTMLInputElement | null {
  return fileInputElement;
}

export function cleanup(): void {
  if (dropZoneElement) {
    dropZoneElement.remove();
    dropZoneElement = null;
  }
  if (fileInputElement) {
    fileInputElement.remove();
    fileInputElement = null;
  }
}
