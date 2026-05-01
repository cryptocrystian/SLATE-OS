import type { Answers } from "./types";

const KEY = "slate.scorecard.v1";

interface StoredState {
  answers: Answers;
  sectionIdx: number;
  completedAt?: string;
}

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadScorecardState(): StoredState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredState;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveScorecardState(state: StoredState) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or disabled — non-fatal */
  }
}

export function clearScorecardState() {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
