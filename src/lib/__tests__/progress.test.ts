import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadProgress,
  saveProgress,
  getChapterProgress,
  completeChapter,
  markVisited,
  isChapterUnlocked,
  getChapterStatus,
  resetProgress,
  countCompleted,
  type ProgressMap,
} from "@/lib/progress";

// Mock localStorage for SSR-safe testing
beforeEach(() => {
  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
  });
  vi.stubGlobal("window", {});
});

describe("progress — load/save", () => {
  it("returns empty object when nothing stored", () => {
    expect(loadProgress()).toEqual({});
  });

  it("round-trips through localStorage", () => {
    const progress: ProgressMap = {
      0: { completed: true, visited: true, completedAt: "2025-01-01" },
    };
    saveProgress(progress);
    expect(loadProgress()).toEqual(progress);
  });
});

describe("progress — getChapterProgress", () => {
  it("returns default for missing chapter", () => {
    expect(getChapterProgress(0, {})).toEqual({
      completed: false,
      visited: false,
    });
  });

  it("returns stored progress", () => {
    const progress: ProgressMap = {
      0: { completed: true, visited: true },
    };
    expect(getChapterProgress(0, progress)).toEqual({
      completed: true,
      visited: true,
    });
  });
});

describe("progress — completeChapter", () => {
  it("marks a chapter as completed", () => {
    const updated = completeChapter(0, {});
    expect(updated[0].completed).toBe(true);
    expect(updated[0].completedAt).toBeDefined();
  });

  it("preserves visited flag", () => {
    const progress: ProgressMap = {
      0: { completed: false, visited: true },
    };
    const updated = completeChapter(0, progress);
    expect(updated[0].visited).toBe(true);
    expect(updated[0].completed).toBe(true);
  });

  it("persists to localStorage", () => {
    completeChapter(0, {});
    const stored = loadProgress();
    expect(stored[0].completed).toBe(true);
  });
});

describe("progress — markVisited", () => {
  it("marks a chapter as visited", () => {
    const updated = markVisited(0, {});
    expect(updated[0].visited).toBe(true);
  });

  it("is idempotent (no-op if already visited)", () => {
    const progress: ProgressMap = {
      0: { completed: false, visited: true },
    };
    const updated = markVisited(0, progress);
    expect(updated).toBe(progress); // same reference, no change
  });
});

describe("progress — isChapterUnlocked", () => {
  it("chapter 0 is always unlocked", () => {
    expect(isChapterUnlocked(0, {})).toBe(true);
  });

  it("chapter N is locked when N-1 is not completed", () => {
    expect(isChapterUnlocked(1, {})).toBe(false);
  });

  it("chapter N is unlocked when N-1 is completed", () => {
    const progress: ProgressMap = {
      0: { completed: true, visited: true },
    };
    expect(isChapterUnlocked(1, progress)).toBe(true);
  });
});

describe("progress — getChapterStatus", () => {
  it("returns 'locked' for uncompleted prerequisite", () => {
    expect(getChapterStatus(1, {})).toBe("locked");
  });

  it("returns 'unlocked' for available but incomplete chapter", () => {
    const progress: ProgressMap = {
      0: { completed: true, visited: true },
    };
    expect(getChapterStatus(1, progress)).toBe("unlocked");
  });

  it("returns 'completed' for a completed chapter", () => {
    const progress: ProgressMap = {
      0: { completed: true, visited: true },
    };
    expect(getChapterStatus(0, progress)).toBe("completed");
  });
});

describe("progress — resetProgress", () => {
  it("clears localStorage and returns empty map", () => {
    saveProgress({ 0: { completed: true, visited: true } });
    const result = resetProgress();
    expect(result).toEqual({});
    expect(loadProgress()).toEqual({});
  });
});

describe("progress — countCompleted", () => {
  it("returns 0 for empty progress", () => {
    expect(countCompleted({})).toBe(0);
  });

  it("counts completed chapters", () => {
    const progress: ProgressMap = {
      0: { completed: true, visited: true },
      1: { completed: true, visited: true },
      2: { completed: false, visited: true },
    };
    expect(countCompleted(progress)).toBe(2);
  });
});