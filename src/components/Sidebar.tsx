"use client";

import Link from "next/link";
import { CHAPTERS } from "@/lib/chapters";
import {
  getChapterStatus,
  type ProgressMap,
  type ChapterStatus,
} from "@/lib/progress";

interface SidebarProps {
  progress: ProgressMap;
  isLoaded: boolean;
  currentChapterId?: number;
}

const STATUS_STYLES: Record<
  ChapterStatus,
  { dot: string; text: string; hover: string; cursor: string }
> = {
  completed: {
    dot: "bg-green-500",
    text: "text-gray-800",
    hover: "hover:bg-gray-100",
    cursor: "cursor-pointer",
  },
  unlocked: {
    dot: "bg-blue-500",
    text: "text-gray-800",
    hover: "hover:bg-gray-100",
    cursor: "cursor-pointer",
  },
  locked: {
    dot: "bg-gray-300",
    text: "text-gray-400",
    hover: "",
    cursor: "cursor-not-allowed",
  },
};

const STATUS_LABELS: Record<ChapterStatus, string> = {
  completed: "completed",
  unlocked: "available",
  locked: "locked",
};

export function Sidebar({ progress, isLoaded, currentChapterId }: SidebarProps) {
  return (
    <nav
      aria-label="Chapters"
      className="flex flex-col gap-1 p-4 h-full overflow-y-auto bg-white border-r border-gray-200"
    >
      <Link
        href="/"
        className="flex items-center gap-2 mb-4 text-gray-700 hover:text-gray-900"
      >
        <span className="text-lg font-bold">Learn dbt</span>
      </Link>

      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        Module 1
      </div>

      {CHAPTERS.map((chapter) => {
        const status: ChapterStatus = isLoaded
          ? getChapterStatus(chapter.id, progress)
          : "unlocked";
        const styles = STATUS_STYLES[status];
        const isActive = currentChapterId === chapter.id;
        const isLocked = status === "locked";

        const linkClass = [
          "flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors",
          styles.hover,
          styles.text,
          styles.cursor,
          isActive
            ? "bg-blue-50 border border-blue-200"
            : "border border-transparent",
        ]
          .filter(Boolean)
          .join(" ");

        const content = (
          <>
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${styles.dot}`}
              aria-hidden
            />
            <span className="flex-1 min-w-0">
              <span className="block font-medium truncate">
                {chapter.id}. {chapter.title}
              </span>
              <span className="block text-xs text-gray-400 truncate">
                {chapter.keyConcept}
              </span>
            </span>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {STATUS_LABELS[status]}
            </span>
          </>
        );

        if (isLocked) {
          return (
            <div
              key={chapter.id}
              className={linkClass}
              aria-disabled
              title="Complete the previous chapter to unlock"
            >
              {content}
            </div>
          );
        }

        return (
          <Link
            key={chapter.id}
            href={`/chapters/${chapter.slug}`}
            className={linkClass}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}