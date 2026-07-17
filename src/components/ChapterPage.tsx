"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getChapterBySlug, getNextChapter } from "@/lib/chapters";
import {
  getChapterStatus,
  isChapterUnlocked,
  getChapterProgress,
} from "@/lib/progress";
import { useProgress } from "@/lib/use-progress";
import { ChapterExerciseRunner } from "./ChapterExerciseRunner";

/**
 * ChapterPage — the split-pane chapter layout.
 *
 * Left pane: story, concept, tables, AI prompt.
 * Right pane: editor + results + verification.
 *
 * On exercise success, marks the chapter complete in localStorage and
 * reveals the "next chapter" navigation.
 */
export function ChapterPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const chapter = useMemo(() => getChapterBySlug(slug), [slug]);

  const { progress, isLoaded, completeChapter, markVisited } = useProgress();
  const [justCompleted, setJustCompleted] = useState(false);

  // Mark visited on mount
  useEffect(() => {
    if (chapter && isLoaded) {
      markVisited(chapter.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter?.id, isLoaded]);

  if (!chapter) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Chapter not found
        </h1>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to home
        </Link>
      </main>
    );
  }

  const status = getChapterStatus(chapter.id, progress);
  const unlocked = isChapterUnlocked(chapter.id, progress);
  const completed = getChapterProgress(chapter.id, progress).completed;
  const nextChapter = getNextChapter(chapter.id);

  if (isLoaded && !unlocked) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center">
          <div className="text-6xl mb-4">&#128274;</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Chapter {chapter.id} is locked
          </h1>
          <p className="text-gray-600 mb-6">
            Complete chapter {chapter.id - 1} first to unlock this chapter.
          </p>
          <Link
            href="/chapters/chapter-0"
            className="text-blue-600 hover:underline"
          >
            Go to Chapter 0
          </Link>
        </div>
      </main>
    );
  }

  const handleComplete = () => {
    if (!completed) {
      completeChapter(chapter.id);
      setJustCompleted(true);
    }
  };

  return (
    <main className="flex flex-col h-full">
      {/* Chapter header bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <div>
          <h1 className="text-lg font-bold text-gray-900">
            Chapter {chapter.id}: {chapter.title}
          </h1>
          <p className="text-xs text-gray-500">{chapter.keyConcept}</p>
        </div>
        <div className="flex items-center gap-3">
          {completed && (
            <span className="inline-flex items-center gap-1 text-sm text-green-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Completed
            </span>
          )}
          {status === "unlocked" && !completed && (
            <span className="inline-flex items-center gap-1 text-sm text-blue-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              In progress
            </span>
          )}
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

          {chapter.tables && chapter.tables.length > 0 && (
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
          )}

          {chapter.aiPrompt && (
            <section className="mb-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
                AI prompt to try
              </h2>
              <blockquote className="border-l-4 border-gray-300 pl-4 text-gray-600 italic">
                {chapter.aiPrompt}
              </blockquote>
            </section>
          )}

          {/* Completion / next chapter navigation */}
          {(completed || justCompleted) && nextChapter && (
            <section className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium mb-3">
                Chapter {chapter.id} complete!
              </p>
              <Link
                href={`/chapters/${nextChapter.slug}`}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Next: Chapter {nextChapter.id} &rarr;
              </Link>
            </section>
          )}

          {(completed || justCompleted) && !nextChapter && (
            <section className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-medium">
                You finished the last chapter! Module 1 is complete.
              </p>
              <Link
                href="/"
                className="text-green-700 hover:underline mt-2 inline-block"
              >
                Back to home
              </Link>
            </section>
          )}
        </div>

        {/* Right pane: editor + verification */}
        <div className="w-1/2 flex flex-col min-h-0 bg-white">
          {chapter.exercise ? (
            <div className="flex-1 min-h-0 flex flex-col">
              <ChapterExerciseRunner
                exercise={chapter.exercise}
                onComplete={handleComplete}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-gray-500">
              <p className="text-center">
                The exercise for this chapter is coming soon.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between px-6 py-2 border-t border-gray-200 bg-white">
        {chapter.id > 0 ? (
          <Link
            href={`/chapters/chapter-${chapter.id - 1}`}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            &larr; Previous
          </Link>
        ) : (
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            &larr; Home
          </Link>
        )}
        {nextChapter && (
          <Link
            href={`/chapters/${nextChapter.slug}`}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Next &rarr;
          </Link>
        )}
      </div>
    </main>
  );
}