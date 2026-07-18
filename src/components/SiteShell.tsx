"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useProgress } from "@/lib/use-progress";

/**
 * SiteShell — the persistent layout wrapping every page.
 * Renders the chapter sidebar on the left and the page content on the right.
 * The sidebar is hidden on mobile/tablet portrait (md:block) and visible on
 * desktop. The content area fills the remaining space.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  const { progress, isLoaded } = useProgress();

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-72 flex-shrink-0 hidden md:block">
        <Sidebar progress={progress} isLoaded={isLoaded} />
      </aside>
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
    </div>
  );
}