import { DEFAULT_STATE } from "./data.js";

const STORAGE_KEY = "nextstage-prototype-v1";

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return deepClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== DEFAULT_STATE.version) return deepClone(DEFAULT_STATE);
    return parsed;
  } catch (error) {
    console.warn("Could not load saved prototype state.", error);
    return deepClone(DEFAULT_STATE);
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  const fresh = deepClone(DEFAULT_STATE);
  saveState(fresh);
  return fresh;
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "nextstage-prototype-data.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
