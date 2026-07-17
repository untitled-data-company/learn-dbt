/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  loadProgress,
  completeChapter,
  markVisited,
  isChapterUnlocked,
  getChapterStatus,
  getChapterProgress,
  countCompleted,
  resetProgress,
  ProgressMap,
} from "@/lib/progress";

describe("progress tracking (localStorage)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts with empty progress", () => {
    expect(loadProgress()).toEqual({});
  });

  it("chapter 0 is always unlocked", () => {
    expect(isChapterUnlocked(0, {})).toBe(true);
  });

  it("chapter 1 is locked when chapter 0 is not completed", () => {
    expect(isChapterUnlocked(1, {})).toBe(false);
    expect(getChapterStatus(1, {})).toBe("locked");
  });

  it("completing chapter 0 unlocks chapter 1", () => {
    const afterComplete = completeChapter(0, {});
    expect(getChapterProgress(0, afterComplete).completed).toBe(true);
    expect(isChapterUnlocked(1, afterComplete)).toBe(true);
    expect(getChapterStatus(1, afterComplete)).toBe("unlocked");
  });

  it("completing chapter 0 marks it as completed status", () => {
    const afterComplete = completeChapter(0, {});
    expect(getChapterStatus(0, afterComplete)).toBe("completed");
  });

  it("markVisited records a visit without completing", () => {
    const afterVisit = markVisited(0, {});
    expect(getChapterProgress(0, afterVisit).visited).toBe(true);
    expect(getChapterProgress(0, afterVisit).completed).toBe(false);
    expect(getChapterStatus(0, afterVisit)).toBe("unlocked");
  });

  it("markVisited is idempotent", () => {
    const once = markVisited(0, {});
    const twice = markVisited(0, once);
    expect(once).toBe(twice);
  });

  it("chapter 2 stays locked until chapter 1 is completed", () => {
    let progress = completeChapter(0, {});
    expect(getChapterStatus(2, progress)).toBe("locked");

    progress = completeChapter(1, progress);
    expect(getChapterStatus(2, progress)).toBe("unlocked");
  });

  it("completeChapter persists to localStorage", () => {
    completeChapter(0, {});
    const stored = localStorage.getItem("learn-dbt:progress");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as ProgressMap;
    expect(parsed[0].completed).toBe(true);
  });

  it("loadProgress reads back persisted data", () => {
    completeChapter(0, {});
    completeChapter(1, loadProgress());
    const loaded = loadProgress();
    expect(getChapterProgress(0, loaded).completed).toBe(true);
    expect(getChapterProgress(1, loaded).completed).toBe(true);
  });

  it("countCompleted returns the right number", () => {
    let progress: ProgressMap = {};
    expect(countCompleted(progress)).toBe(0);

    progress = completeChapter(0, progress);
    expect(countCompleted(progress)).toBe(1);

    progress = completeChapter(1, progress);
    expect(countCompleted(progress)).toBe(2);
  });

  it("resetProgress clears localStorage", () => {
    completeChapter(0, {});
    expect(localStorage.getItem("learn-dbt:progress")).not.toBeNull();
    resetProgress();
    expect(localStorage.getItem("learn-dbt:progress")).toBeNull();
    expect(loadProgress()).toEqual({});
  });

  it("saveProgress handles corrupted localStorage gracefully", () => {
    localStorage.setItem("learn-dbt:progress", "not-json{");
    expect(loadProgress()).toEqual({});
  });

  it("getChapterProgress defaults to not-visited, not-completed", () => {
    const progress = getChapterProgress(5, {});
    expect(progress.completed).toBe(false);
    expect(progress.visited).toBe(false);
  });
});