import { EventManager } from "./eventManager.js";

let toastContainer = null;
let toastEventManager = null;

function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    toastContainer.setAttribute("aria-live", "polite");
    toastContainer.setAttribute("aria-atomic", "true");
    document.body.appendChild(toastContainer);
  }
  if (!toastEventManager) {
    toastEventManager = new EventManager();
  }
  return toastContainer;
}

export function showToast(message, type = "info", duration = 3000) {
  const container = ensureContainer();
  
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "alert");
  
  const content = document.createElement("span");
  content.className = "toast__content";
  content.textContent = message;
  toast.appendChild(content);
  
  const closeBtn = document.createElement("button");
  closeBtn.className = "toast__close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "关闭");
  closeBtn.innerHTML = "&times;";
  closeBtn.addEventListener("click", () => removeToast(toast));
  toast.appendChild(closeBtn);
  
  container.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add("toast--visible");
  });
  
  if (duration > 0) {
    const timerId = toastEventManager.setTimeout(() => {
      removeToast(toast);
    }, duration);
    toast.dataset.timerId = String(timerId);
  }
  
  return toast;
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  
  const timerId = toast.dataset.timerId;
  if (timerId) {
    toastEventManager.clearTimeout(Number(timerId));
  }
  
  toast.classList.remove("toast--visible");
  toast.classList.add("toast--hiding");
  
  setTimeout(() => {
    if (toast.parentElement) {
      toast.parentElement.removeChild(toast);
    }
  }, 300);
}

export function showSuccess(message, duration = 3000) {
  return showToast(message, "success", duration);
}

export function showError(message, duration = 4000) {
  return showToast(message, "error", duration);
}

export function showWarning(message, duration = 3500) {
  return showToast(message, "warning", duration);
}

export function showInfo(message, duration = 3000) {
  return showToast(message, "info", duration);
}

export function clearAllToasts() {
  if (toastContainer) {
    while (toastContainer.firstChild) {
      removeToast(toastContainer.firstChild);
    }
  }
  if (toastEventManager) {
    toastEventManager.clearAll();
  }
}
