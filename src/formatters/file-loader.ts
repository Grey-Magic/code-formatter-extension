/**
 * File Loader Utilities
 * Handles reading local files with size limits and language detection
 */

import { getLanguageFromFilename, formatFileSize, CODE_EXTENSIONS_RE } from "../shared/utils";

/**
 * File metadata information
 */
export interface LoadedFileInfo {
  name: string;
  path: string;
  size: number;
  lastModified: Date;
  mimeType: string;
}

/**
 * Result of file loading operation
 */
export interface FileLoadResult {
  success: boolean;
  code?: string;
  language?: string;
  fileInfo?: LoadedFileInfo;
  error?: string;
}

/**
 * Maximum file size limit (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * File size limit in human-readable format
 */
export const MAX_FILE_SIZE_LABEL = "10MB";

/**
 * Read a local file and return its content
 * Handles encoding issues and removes BOM if present
 */
export async function readLocalFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      let content = reader.result as string;

      // Remove BOM (Byte Order Mark) if present
      // UTF-8 BOM: EF BB BF
      // UTF-16 BE BOM: FE FF
      // UTF-16 LE BOM: FF FE
      if (content.charCodeAt(0) === 0xfeff) {
        content = content.substring(1);
      }

      resolve(content);
    };

    reader.onerror = () => {
      let errorMessage = `Failed to read file: ${file.name}`;

      // Provide more specific error information
      // DOMException error codes: https://developer.mozilla.org/en-US/docs/Web/API/DOMException
      const errorCode = reader.error?.code;
      switch (errorCode) {
        case 8: // NOT_FOUND_ERR
          errorMessage = `File not found: ${file.name}`;
          break;
        case 4: // NOT_READABLE_ERR
          errorMessage = `File not readable (permissions issue): ${file.name}`;
          break;
        case 20: // ABORT_ERR
          errorMessage = `File reading aborted: ${file.name}`;
          break;
        default:
          errorMessage = `Failed to read file: ${file.name}${errorCode !== undefined ? ` (Error code: ${errorCode})` : ""}`;
      }

      reject(new Error(errorMessage));
    };

    reader.onabort = () => {
      reject(new Error(`File reading aborted: ${file.name}`));
    };

    // Use UTF-8 encoding explicitly
    reader.readAsText(file, "UTF-8");
  });
}

/**
 * Get file metadata
 */
export function getFileMetadata(file: File): LoadedFileInfo {
  return {
    name: file.name,
    path: file.webkitRelativePath || file.name,
    size: file.size,
    lastModified: new Date(file.lastModified),
    mimeType: file.type || "text/plain",
  };
}

/**
 * Validate file before loading
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check if file exists
  if (!file) {
    return {
      valid: false,
      error: "No file provided",
    };
  }

  // Check if file has a name
  if (!file.name) {
    return {
      valid: false,
      error: "File has no name",
    };
  }

  // Check file size (empty file check)
  if (file.size === 0) {
    return {
      valid: false,
      error: `File is empty: ${file.name}`,
    };
  }

  // Check maximum file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size (${formatFileSize(file.size)}) exceeds maximum limit of ${MAX_FILE_SIZE_LABEL}`,
    };
  }

  // Check if file type is text-based
  const mime = file.type || "";
  const textMimeTypes = [
    "text/",
    "application/json",
    "application/javascript",
    "application/xml",
    "application/x-httpd-php",
    "application/x-python-code",
  ];
  const isTextFile =
    textMimeTypes.some((type) => mime.startsWith(type)) ||
    CODE_EXTENSIONS_RE.test(file.name);

  if (!isTextFile) {
    return {
      valid: false,
      error: `Unsupported file type: ${mime || "unknown"}`,
    };
  }

  return { valid: true };
}

/**
 * Load a file with validation
 */
export async function loadFile(file: File): Promise<FileLoadResult> {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // Read file content with timeout protection
    const code = await Promise.race([
      readLocalFile(file),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("File reading timeout")), 30000),
      ),
    ]);

    // Detect language using shared utility
    const language = getLanguageFromFilename(file.name);
    if (!language) {
      return {
        success: false,
        code,
        error: `Could not detect language for file: ${file.name}`,
      };
    }

    // Get file metadata
    const fileInfo = getFileMetadata(file);

    return {
      success: true,
      code,
      language,
      fileInfo,
    };
  } catch (error) {
    // Handle different types of errors
    let errorMessage = "Failed to load file";

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Load multiple files
 * Continues loading even if some files fail
 */
export async function loadFiles(files: File[]): Promise<FileLoadResult[]> {
  if (!files || !Array.isArray(files)) {
    return [
      {
        success: false,
        error: "Invalid files array provided",
      },
    ];
  }

  if (files.length === 0) {
    return [];
  }

  const results = await Promise.all(
    files.map(async (file) => {
      try {
        return await loadFile(file);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Unknown error occurred while loading file";

        return {
          success: false,
          error: errorMessage,
        };
      }
    }),
  );

  return results;
}
