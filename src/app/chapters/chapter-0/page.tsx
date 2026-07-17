"use client";

import { useMemo } from "react";
import { getChapterBySlug } from "@/lib/chapters";
import { ChapterExerciseRunner } from "@/components/ChapterExerciseRunner";

/**
 * Chapter 0 page — Luca's morning query.
 *
 * Left pane: story, concept, table list.
 * Right pane: SQL exercise with starter query, Run button, and Hint button.
 */
export default function Chapter0Page() {
  const chapter = useMemo(() => getChapterBySlug("chapter-0"), []);

  if (!chapter) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Chapter not found
        </h1>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-full">
      {/* Chapter header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Chapter {chapter.id}: {chapter.title}
          </h1>
          <p className="text-xs text-gray-500">{chapter.keyConcept}</p>
        </div>
      </div>

      {/* Split-pane body */}
      <div className="flex flex-1 min-h-0">
        {/* Left pane: story */}
        <div className="w-1/2 overflow-y-auto p-6 border-r border-gray-200 bg-gray-50">
          <section className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Story
            </h2>
            <p className="text-gray-800 leading-relaxed whitespace-pre-line">
              {chapter.story}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Concept
            </h2>
            <p className="text-gray-800 leading-relaxed whitespace-pre-line">
              {chapter.concept}
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Tables
            </h2>
            <ul className="space-y-1">
              {chapter.tables.map((table) => (
                <li
                  key={table}
                  className="font-mono text-sm text-gray-700 bg-white border border-gray-200 rounded px-3 py-1.5"
                >
                  {table}
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Right pane: exercise */}
        <div className="w-1/2 flex flex-col min-h-0 bg-white">
          <ChapterExerciseRunner exercise={chapter.exercise} />
        </div>
      </div>
    </main>
  );
}