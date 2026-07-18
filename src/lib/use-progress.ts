"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ProgressMap,
  loadProgress,
  completeChapter,
  markVisited,
  resetProgress,
} from "@/lib/progress";

/**
 * React hook wrapping progress state synced to localStorage.
 *
 * Provides:
 * - `progress`: current ProgressMap
 * - `completeChapter(id)`: mark a chapter done, persists
 * - `markVisited(id)`: mark a chapter opened, persists
 * - `reset()`: clear all progress
 * - `isLoaded`: false during SSR / first read
 */
export function useProgress() {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
    setIsLoaded(true);
  }, []);

  const handleComplete = useCallback((chapterId: number) => {
    setProgress((prev) => completeChapter(chapterId, prev));
  }, []);

  const handleVisit = useCallback((chapterId: number) => {
    setProgress((prev) => markVisited(chapterId, prev));
  }, []);

  const handleReset = useCallback(() => {
    setProgress(resetProgress());
  }, []);

  return {
    progress,
    isLoaded,
    completeChapter: handleComplete,
    markVisited: handleVisit,
    reset: handleReset,
  };
}