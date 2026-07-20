"use client";

import { useState } from "react";
import { getTableMetadata } from "@/lib/table-metadata";

interface TableExplorerCardProps {
  tableName: string;
}

/**
 * TableExplorerCard — a clickable card for a raw table name. Clicking the
 * header expands it to show columns and their datatypes; a flip button in
 * the top-right corner of the expanded section swaps to a preview of
 * sample values from the table. The table name stays visible in the
 * header regardless of state.
 */
export function TableExplorerCard({ tableName }: TableExplorerCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<"schema" | "values">("schema");
  const metadata = getTableMetadata(tableName);

  return (
    <div className="border border-gray-200 rounded bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-1.5 font-mono text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        aria-expanded={expanded}
      >
        <span>{tableName}</span>
        {metadata && (
          <span className="text-gray-400 text-xs" aria-hidden="true">
            {expanded ? "▲" : "▼"}
          </span>
        )}
      </button>

      {expanded && metadata && (
        <div className="border-t border-gray-200 px-3 py-2 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {view === "schema" ? "Columns" : "Sample values"}
            </span>
            <button
              type="button"
              onClick={() =>
                setView((v) => (v === "schema" ? "values" : "schema"))
              }
              className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1"
              title={
                view === "schema"
                  ? "Flip to see sample values"
                  : "Flip to see columns"
              }
            >
              <span aria-hidden="true">&#8646;</span>
              {view === "schema" ? "Values" : "Columns"}
            </button>
          </div>

          {view === "schema" ? (
            <table className="w-full text-xs">
              <tbody>
                {metadata.columns.map((col) => (
                  <tr
                    key={col.name}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="font-mono text-gray-800 py-1 pr-3">
                      {col.name}
                    </td>
                    <td className="text-gray-400 py-1">{col.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    {metadata.columns.map((col) => (
                      <th
                        key={col.name}
                        className="text-left font-mono font-medium text-gray-500 border-b border-gray-200 pr-3 pb-1 whitespace-nowrap"
                      >
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metadata.sampleRows.map((row, i) => (
                    <tr key={i}>
                      {metadata.columns.map((col) => (
                        <td
                          key={col.name}
                          className="font-mono text-gray-700 pr-3 py-1 whitespace-nowrap"
                        >
                          {String(row[col.name] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
