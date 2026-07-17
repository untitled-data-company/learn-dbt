/**
 * Chapter progress tracking — localStorage-backed for the MVP.
 *
 * Progress is stored as a map of chapterId -> ChapterProgress.
 * Chapters unlock sequentially: chapter N is unlocked when chapter N-1
 * is completed. Chapter 0 is always unlocked.
 *
 * All functions are SSR-safe: they no-op on the server and read/write
 * only when `window` is available (client-side).
 */

import { CHAPTERS } from "./chapters";

const STORAGE_KEY = "learn-dbt:progress";

export interface ChapterProgress {
  /** Whether the chapter exercise has been completed */
  completed: boolean;
  /** ISO timestamp of completion */
  completedAt?: string;
  /** Whether the chapter has been visited (opened) */
  visited: boolean;
}

export type ProgressMap = Record<number, ChapterProgress>;

/** Check if we're running in the browser (not SSR) */
function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Read all progress from localStorage */
export function loadProgress(): ProgressMap {
  if (!isBrowser()) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ProgressMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Write all progress to localStorage */
export function saveProgress(progress: ProgressMap): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.error("Failed to save progress", err);
  }
}

/** Get progress for a single chapter, defaulting to {completed: false, visited: false} */
export function getChapterProgress(
  chapterId: number,
  progress: ProgressMap
): ChapterProgress {
  return (
    progress[chapterId] ?? { completed: false, visited: false }
  );
}

/**
 * Mark a chapter as completed and persist.
 * Returns the updated ProgressMap.
 */
export function completeChapter(
  chapterId: number,
  progress: ProgressMap
): ProgressMap {
  const existing = getChapterProgress(chapterId, progress);
  const updated: ProgressMap = {
    ...progress,
    [chapterId]: {
      ...existing,
      completed: true,
      completedAt: new Date().toISOString(),
    },
  };
  saveProgress(updated);
  return updated;
}

/**
 * Mark a chapter as visited (opened) and persist.
 * Returns the updated ProgressMap.
 */
export function markVisited(
  chapterId: number,
  progress: ProgressMap
): ProgressMap {
  const existing = getChapterProgress(chapterId, progress);
  if (existing.visited) return progress;
  const updated: ProgressMap = {
    ...progress,
    [chapterId]: { ...existing, visited: true },
  };
  saveProgress(updated);
  return updated;
}

/**
 * Determine whether a chapter is unlocked.
 * Chapter 0 is always unlocked.
 * Chapter N is unlocked if chapter N-1 is completed.
 */
export function isChapterUnlocked(
  chapterId: number,
  progress: ProgressMap
): boolean {
  if (chapterId === 0) return true;
  const prev = getChapterProgress(chapterId - 1, progress);
  return prev.completed;
}

/**
 * Compute the status of a chapter for display.
 * - "completed": exercise done
 * - "unlocked": available but not done
 * - "locked": previous chapter not yet completed
 */
export function getChapterStatus(
  chapterId: number,
  progress: ProgressMap
): "completed" | "unlocked" | "locked" {
  if (getChapterProgress(chapterId, progress).completed) {
    return "completed";
  }
  if (isChapterUnlocked(chapterId, progress)) {
    return "unlocked";
  }
  return "locked";
}

/** Reset all progress (for testing or a "start over" button) */
export function resetProgress(): ProgressMap {
  if (isBrowser()) {
    localStorage.removeItem(STORAGE_KEY);
  }
  return {};
}

/**
 * Count completed chapters.
 */
export function countCompleted(progress: ProgressMap): number {
  return CHAPTERS.filter((c) =>
    getChapterProgress(c.id, progress).completed
  ).length;
}