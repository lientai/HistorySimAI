export class EventManager {
  constructor() {
    this.controllers = new Map();
    this.timers = new Set();
    this.intervals = new Set();
  }

  addEventListener(target, type, handler, options = {}) {
    const controller = new AbortController();
    const id = Symbol('event');
    
    target.addEventListener(type, handler, {
      ...options,
      signal: controller.signal,
    });
    
    this.controllers.set(id, { target, type, handler, controller });
    return id;
  }

  removeEventListener(id) {
    const entry = this.controllers.get(id);
    if (entry) {
      entry.controller.abort();
      this.controllers.delete(id);
    }
  }

  setTimeout(callback, delay, ...args) {
    const timerId = setTimeout(() => {
      this.timers.delete(timerId);
      callback(...args);
    }, delay);
    this.timers.add(timerId);
    return timerId;
  }

  clearTimeout(timerId) {
    clearTimeout(timerId);
    this.timers.delete(timerId);
  }

  setInterval(callback, delay, ...args) {
    const intervalId = setInterval(callback, delay, ...args);
    this.intervals.add(intervalId);
    return intervalId;
  }

  clearInterval(intervalId) {
    clearInterval(intervalId);
    this.intervals.delete(intervalId);
  }

  clearAll() {
    for (const [id, entry] of this.controllers) {
      entry.controller.abort();
    }
    this.controllers.clear();
    
    for (const timerId of this.timers) {
      clearTimeout(timerId);
    }
    this.timers.clear();
    
    for (const intervalId of this.intervals) {
      clearInterval(intervalId);
    }
    this.intervals.clear();
  }

  get size() {
    return this.controllers.size + this.timers.size + this.intervals.size;
  }
}

export function createEventManager() {
  return new EventManager();
}

const globalManagers = new Map();

export function getGlobalManager(key) {
  if (!globalManagers.has(key)) {
    globalManagers.set(key, new EventManager());
  }
  return globalManagers.get(key);
}

export function clearGlobalManager(key) {
  const manager = globalManagers.get(key);
  if (manager) {
    manager.clearAll();
    globalManagers.delete(key);
  }
}
