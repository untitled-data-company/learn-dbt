import { describe, it, expect } from "vitest";
import {
  CHAPTERS,
  TOTAL_CHAPTERS,
  getChapterById,
  getChapterBySlug,
  getNextChapter,
  getPrevChapter,
} from "@/lib/chapters";

describe("chapters — metadata", () => {
  it("has at least 3 chapters defined", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(3);
  });
  it("has sequential ids starting from 0", () => {
    CHAPTERS.forEach((ch, i) => { expect(ch.id).toBe(i); });
  });
  it("has unique slugs", () => {
    const slugs = CHAPTERS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
  it("TOTAL_CHAPTERS matches CHAPTERS.length", () => {
    expect(TOTAL_CHAPTERS).toBe(CHAPTERS.length);
  });
});

describe("chapters — character cards", () => {
  it("every chapter has at least one character", () => {
    CHAPTERS.forEach((ch) => { expect(ch.characters.length).toBeGreaterThanOrEqual(1); });
  });
  it("chapter 0 has Luca", () => {
    const ch0 = getChapterById(0);
    expect(ch0!.characters.some((c) => c.name === "Luca")).toBe(true);
  });
  it("chapter 1 has the Manager", () => {
    const ch1 = getChapterById(1);
    expect(ch1!.characters.some((c) => c.name === "The Manager")).toBe(true);
  });
  it("chapter 2 has Giulia", () => {
    const ch2 = getChapterById(2);
    expect(ch2!.characters.some((c) => c.name === "Giulia")).toBe(true);
  });
  it("all character cards have name, role, and description", () => {
    CHAPTERS.forEach((ch) => {
      ch.characters.forEach((char) => {
        expect(char.name).toBeTruthy();
        expect(char.role).toBeTruthy();
        expect(char.description).toBeTruthy();
      });
    });
  });
});

describe("chapters — exercises", () => {
  it("chapters 0-2 have exercises defined", () => {
    for (let i = 0; i <= 2; i++) {
      const ch = getChapterById(i);
      expect(ch!.exercise).toBeDefined();
    }
  });
  it("every exercise has prompt, initialSql (or files), fileName (or files), and language (or files)", () => {
    CHAPTERS.forEach((ch) => {
      if (ch.exercise) {
        expect(ch.exercise.prompt).toBeTruthy();
        if (ch.exercise.files) {
          expect(ch.exercise.files.length).toBeGreaterThanOrEqual(1);
          ch.exercise.files.forEach((f) => {
            expect(f.fileName).toBeTruthy();
            expect(f.language).toBeTruthy();
            expect(f.initialSql).toBeTruthy();
          });
        } else {
          expect(ch.exercise.initialSql).toBeTruthy();
          expect(ch.exercise.fileName).toBeTruthy();
          expect(ch.exercise.language).toBeTruthy();
        }
      }
    });
  });
  it("chapter 0 exercise is SQL", () => {
    expect(getChapterById(0)!.exercise!.language).toBe("sql");
  });
  it("chapter 0 exercise has expectedRows with 4 rows", () => {
    const ch = getChapterById(0);
    expect(ch!.exercise!.expectedRows).toBeDefined();
    expect(ch!.exercise!.expectedRows!.length).toBe(4);
  });
  it("chapter 2 exercise uses files array with YAML and SQL-Jinja", () => {
    const ch = getChapterById(2);
    expect(ch!.exercise!.files).toBeDefined();
    expect(ch!.exercise!.files!.length).toBe(2);
    expect(ch!.exercise!.files![0].language).toBe("yaml");
    expect(ch!.exercise!.files![0].fileName).toBe("models/sources.yml");
    expect(ch!.exercise!.files![1].language).toBe("sql-jinja");
    expect(ch!.exercise!.files![1].fileName).toBe("models/daily_revenue.sql");
  });
  it("chapter 2 exercise has useDbtRun flag", () => {
    expect(getChapterById(2)!.exercise!.useDbtRun).toBe(true);
  });
});

describe("chapters — lookup helpers", () => {
  it("getChapterById returns the right chapter", () => {
    expect(getChapterById(0)?.slug).toBe("chapter-0");
    expect(getChapterById(99)).toBeUndefined();
  });
  it("getChapterBySlug returns the right chapter", () => {
    expect(getChapterBySlug("chapter-0")?.id).toBe(0);
    expect(getChapterBySlug("nonexistent")).toBeUndefined();
  });
  it("getNextChapter returns the next chapter or null", () => {
    expect(getNextChapter(0)?.id).toBe(1);
    expect(getNextChapter(CHAPTERS.length - 1)).toBeNull();
  });
  it("getPrevChapter returns the previous chapter or null", () => {
    expect(getPrevChapter(1)?.id).toBe(0);
    expect(getPrevChapter(0)).toBeNull();
  });
});
