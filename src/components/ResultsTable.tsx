"use client";

interface ResultsTableProps {
  rows: Record<string, unknown>[];
  caption?: string;
}

export function ResultsTable({ rows, caption }: ResultsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-gray-500 p-4 border border-gray-200 rounded bg-gray-50">
        No rows returned.
      </div>
    );
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="overflow-auto border border-gray-200 rounded bg-white">
      {caption && (
        <div className="px-4 py-2 text-sm font-semibold text-gray-700 border-b border-gray-200 bg-gray-50">
          {caption}
        </div>
      )}
      <table className="min-w-full text-sm text-left">
        <thead className="bg-gray-100 text-gray-700 font-medium">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-2 border-b border-gray-200 whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="even:bg-gray-50">
              {columns.map((col) => (
                <td key={`${i}-${col}`} className="px-4 py-2 border-b border-gray-200 whitespace-nowrap">
                  {formatCell(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
