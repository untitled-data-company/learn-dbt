"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import type { CharacterCard } from "@/lib/chapters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoryPanelProps {
  /** Chapter id for navigation links */
  chapterId: number;
  /** Chapter title shown in the header */
  chapterTitle: string;
  /** Story narrative (markdown) */
  story: string;
  /** Concept explanation (markdown) */
  concept: string;
  /** Character cards to display */
  characters: CharacterCard[];
  /** Tables available in this chapter */
  tables?: string[];
  /** AI prompt suggestion */
  aiPrompt?: string;
  /** Whether the chapter has been completed */
  completed: boolean;
  /** Whether the chapter was just completed (for animation) */
  justCompleted: boolean;
  /** Next chapter data for navigation, or null if this is the last */
  nextChapter: { id: number; slug: string } | null;
}

// ---------------------------------------------------------------------------
// StoryPanel
// ---------------------------------------------------------------------------

/**
 * StoryPanel — the left-pane content for a chapter page.
 *
 * Renders:
 *  - Collapsible character cards with avatar placeholders
 *  - Story narrative (markdown)
 *  - Concept explanation (markdown)
 *  - Tables list
 *  - AI prompt suggestion
 *  - Completion / next-chapter navigation
 *
 * Responsive: full width, scrollable container.
 */
export function StoryPanel({
  chapterId,
  chapterTitle,
  story,
  concept,
  characters,
  tables,
  aiPrompt,
  completed,
  justCompleted,
  nextChapter,
}: StoryPanelProps) {
  return (
    <div className="overflow-y-auto p-6">
      {/* Chapter header */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-gray-900">
          Chapter {chapterId}: {chapterTitle}
        </h1>
      </div>

      {/* Character cards */}
      {characters.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">
            Cast
          </h2>
          <div className="grid gap-3">
            {characters.map((char) => (
              <CharacterCardDisplay key={char.name} character={char} />
            ))}
          </div>
        </section>
      )}

      {/* Story */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Story
        </h2>
        <div className="prose prose-sm prose-gray max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{story}</ReactMarkdown>
        </div>
      </section>

      {/* Concept */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Concept
        </h2>
        <div className="prose prose-sm prose-gray max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{concept}</ReactMarkdown>
        </div>
      </section>

      {/* Tables */}
      {tables && tables.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Tables
          </h2>
          <ul className="space-y-1">
            {tables.map((table) => (
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

      {/* AI prompt */}
      {aiPrompt && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-2">
            AI prompt to try
          </h2>
          <blockquote className="border-l-4 border-gray-300 pl-4 text-gray-600 italic">
            {aiPrompt}
          </blockquote>
        </section>
      )}

      {/* Completion / next chapter navigation */}
      {(completed || justCompleted) && nextChapter && (
        <section className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-800 font-medium mb-3">
            Chapter {chapterId} complete!
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
  );
}

// ---------------------------------------------------------------------------
// CharacterCardDisplay
// ---------------------------------------------------------------------------

/**
 * CharacterCardDisplay — a collapsible card for a story character.
 *
 * Shows an avatar placeholder (initials), name, role, and a short description.
 * Clicking the card header toggles the description visibility.
 */
function CharacterCardDisplay({ character }: { character: CharacterCard }) {
  const [expanded, setExpanded] = useState(false);

  const initials = character.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors rounded-lg"
        aria-expanded={expanded}
      >
        {/* Avatar placeholder */}
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
          {initials}
        </span>

        {/* Name and role */}
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-gray-900 text-sm">
            {character.name}
          </span>
          <span className="text-xs text-gray-400 ml-2">
            {character.role}
          </span>
        </div>

        {/* Expand/collapse indicator */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Description (collapsible) */}
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <p className="text-xs text-gray-600 leading-relaxed">
            {character.description}
          </p>
        </div>
      )}
    </div>
  );
}
