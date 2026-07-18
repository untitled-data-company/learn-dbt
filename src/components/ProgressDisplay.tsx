"use client";

import { useProgress } from "@/lib/use-progress";
import { countCompleted } from "@/lib/progress";
import { TOTAL_CHAPTERS } from "@/lib/chapters";

/**
 * ProgressDisplay — shows the learner's overall progress on the home page.
 * Reads from localStorage via the useProgress hook.
 */
export function ProgressDisplay() {
  const { progress, isLoaded } = useProgress();

  if (!isLoaded) return null;

  const completed = countCompleted(progress);
  const pct = TOTAL_CHAPTERS > 0 ? Math.round((completed / TOTAL_CHAPTERS) * 100) : 0;

  if (completed === 0) return null;

  return (
    <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-blue-800">
          Your progress
        </span>
        <span className="text-sm text-blue-600">
          {completed} / {TOTAL_CHAPTERS} chapters ({pct}%)
        </span>
      </div>
      <div className="w-full bg-blue-100 rounded-full h-2 overflow-hidden">
        <div
          className="bg-blue-500 h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}