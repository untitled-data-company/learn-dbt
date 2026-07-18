"use client";

import Link from "next/link";
import { CHAPTERS } from "@/lib/chapters";
import { useProgress } from "@/lib/use-progress";
import {
  getChapterStatus,
  countCompleted,
  type ChapterStatus,
} from "@/lib/progress";
import { ProgressDisplay } from "@/components/ProgressDisplay";

const STATUS_STYLES: Record<
  ChapterStatus,
  { dot: string; text: string; label: string }
> = {
  completed: {
    dot: "bg-green-500",
    text: "text-green-700",
    label: "Completed",
  },
  unlocked: {
    dot: "bg-blue-500",
    text: "text-blue-700",
    label: "Available",
  },
  locked: {
    dot: "bg-gray-300",
    text: "text-gray-400",
    label: "Locked",
  },
};

export default function Home() {
  const { progress, isLoaded } = useProgress();

  const completed = countCompleted(progress);
  const total = CHAPTERS.length;

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Learn dbt</h1>
        <p className="text-gray-600">
          An interactive dbt learning platform. Follow Luca as he discovers
          dbt, makes mistakes, and learns from Giulia and the Manager.
        </p>
      </div>

      <ProgressDisplay />

      <div className="space-y-2">
        {CHAPTERS.map((chapter) => {
          const status: ChapterStatus = isLoaded
            ? getChapterStatus(chapter.id, progress)
            : chapter.id === 0
              ? "unlocked"
              : "locked";
          const styles = STATUS_STYLES[status];
          const isLocked = status === "locked";

          const card = (
            <div
              className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                isLocked
                  ? "border-gray-100 bg-gray-50"
                  : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm"
              }`}
            >
              <span
                className={`w-3 h-3 rounded-full flex-shrink-0 ${styles.dot}`}
                aria-hidden
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-gray-900">
                    Chapter {chapter.id}
                  </span>
                  <span className="text-sm text-gray-500 truncate">
                    {chapter.title}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {chapter.keyConcept}
                </p>
              </div>
              <span className={`text-xs font-medium ${styles.text}`}>
                {styles.label}
              </span>
            </div>
          );

          if (isLocked) {
            return (
              <div key={chapter.id} title="Complete the previous chapter to unlock">
                {card}
              </div>
            );
          }

          return (
            <Link
              key={chapter.id}
              href={`/chapters/${chapter.slug}`}
              className="block"
            >
              {card}
            </Link>
          );
        })}
      </div>

      {completed === total && total > 0 && (
        <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg text-center">
          <p className="text-green-800 font-semibold text-lg mb-1">
            All chapters complete!
          </p>
          <p className="text-green-700 text-sm">
            You finished the entire module. Well done.
          </p>
        </div>
      )}
    </main>
  );
}
