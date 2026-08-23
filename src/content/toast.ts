import type { ToastType } from "./types";
import { CSS_CLASSES } from "../shared/constants";

const TOAST_FADE_IN_DURATION = 300;
const TOAST_DEFAULT_DURATION = 3000;
const TOAST_STACK_GAP = 10;

const TOAST_COLORS: Record<ToastType, string> = {
  error: "#e53935",
  success: "#43a047",
  info: "#333",
  warning: "#ff9800",
};

let toastStylesInjected = false;

function injectToastStyles(): void {
  if (toastStylesInjected) return;
  const style = document.createElement("style");
  style.id = CSS_CLASSES.TOAST_STYLES;
  style.textContent = `
    @keyframes code-formatter-fadeIn { 
      from { opacity: 0; transform: translateX(-50%) translateY(20px); } 
      to { opacity: 1; transform: translateX(-50%) translateY(0); } 
    }
    @keyframes code-formatter-fadeOut { 
      from { opacity: 1; } 
      to { opacity: 0; } 
    }
  `;
  document.head.appendChild(style);
  toastStylesInjected = true;
}

const activeToasts: HTMLDivElement[] = [];

function repositionToasts(): void {
  let bottom = 20;
  for (const t of activeToasts) {
    t.style.bottom = `${bottom}px`;
    bottom += t.offsetHeight + TOAST_STACK_GAP;
  }
}

export function showToast(
  message: string,
  type: ToastType = "info",
  duration: number = TOAST_DEFAULT_DURATION,
): void {
  injectToastStyles();

  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${TOAST_COLORS[type]};
    color: white;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: code-formatter-fadeIn ${TOAST_FADE_IN_DURATION}ms ease;
    white-space: nowrap;
  `;
  toast.textContent = message;

  document.body.appendChild(toast);
  activeToasts.push(toast);
  repositionToasts();

  setTimeout(() => {
    toast.style.animation = `code-formatter-fadeOut ${TOAST_FADE_IN_DURATION}ms ease`;
    setTimeout(() => {
      toast.remove();
      const idx = activeToasts.indexOf(toast);
      if (idx !== -1) activeToasts.splice(idx, 1);
      repositionToasts();
    }, TOAST_FADE_IN_DURATION);
  }, duration);
}
