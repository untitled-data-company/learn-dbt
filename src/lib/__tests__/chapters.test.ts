import { describe, it, expect } from "vitest";
import {
  CHAPTERS,
  TOTAL_CHAPTERS,
  getChapterById,
  getChapterBySlug,
  getNextChapter,
  getPrevChapter,
} from "@/lib/chapters";

describe("chapters metadata", () => {
  it("has 8 chapters matching the README module table", () => {
    expect(TOTAL_CHAPTERS).toBe(8);
    expect(CHAPTERS).toHaveLength(8);
  });

  it("chapters are numbered 0 through 7 sequentially", () => {
    CHAPTERS.forEach((chapter, index) => {
      expect(chapter.id).toBe(index);
    });
  });

  it("each chapter has a unique slug", () => {
    const slugs = CHAPTERS.map((c) => c.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it("chapter 0 is Luca's morning query", () => {
    const ch0 = getChapterById(0);
    expect(ch0).toBeDefined();
    expect(ch0!.title).toBe("Luca's morning query");
    expect(ch0!.keyConcept).toBe("Pure SQL exploration");
    expect(ch0!.exercise).toBeDefined();
  });

  it("getChapterBySlug returns the right chapter", () => {
    const ch1 = getChapterBySlug("chapter-1");
    expect(ch1).toBeDefined();
    expect(ch1!.id).toBe(1);
  });

  it("getChapterBySlug returns undefined for unknown slug", () => {
    expect(getChapterBySlug("nonexistent")).toBeUndefined();
  });

  it("getNextChapter returns the following chapter", () => {
    const next = getNextChapter(0);
    expect(next).not.toBeNull();
    expect(next!.id).toBe(1);
  });

  it("getNextChapter returns null for the last chapter", () => {
    expect(getNextChapter(7)).toBeNull();
  });

  it("getPrevChapter returns the preceding chapter", () => {
    const prev = getPrevChapter(1);
    expect(prev).not.toBeNull();
    expect(prev!.id).toBe(0);
  });

  it("getPrevChapter returns null for chapter 0", () => {
    expect(getPrevChapter(0)).toBeNull();
  });
});