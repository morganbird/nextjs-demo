"use client";

import { useEffect, useState, useCallback } from "react";

export default function Digest() {
  const [digest, setDigest] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDigest("");

    try {
      const response = await fetch("/api/bluesky/digest");

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate digest");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setDigest((prev) => prev + text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  return (
    <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Daily Digest
        </h2>
        <button
          onClick={fetchDigest}
          disabled={loading}
          className="rounded-full px-3 py-1 text-sm font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {loading ? "Generating..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          Error: {error}
        </div>
      ) : loading && !digest ? (
        <div className="text-zinc-500 dark:text-zinc-400">
          Generating your daily digest...
        </div>
      ) : (
        <div className="prose prose-zinc dark:prose-invert max-w-none text-sm">
          <DigestContent content={digest} />
        </div>
      )}
    </div>
  );
}

function DigestContent({ content }: { content: string }) {
  // Simple markdown-like rendering
  const lines = content.split("\n");

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3
              key={i}
              className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mt-4 first:mt-0"
            >
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("- **")) {
          // Notable post line
          const match = line.match(/^- \*\*(@[\w.]+)\*\*:?\s*(.*)$/);
          if (match) {
            return (
              <p key={i} className="text-zinc-700 dark:text-zinc-300 ml-2">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {match[1]}
                </span>
                : {match[2]}
              </p>
            );
          }
        }
        if (line.startsWith("- [Link")) {
          const match = line.match(/\[Link[^\]]*\]\(([^)]+)\)/);
          if (match) {
            return (
              <a
                key={i}
                href={match[1]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline ml-4 text-xs block"
              >
                View post
              </a>
            );
          }
        }
        if (line.startsWith("- ")) {
          return (
            <p key={i} className="text-zinc-700 dark:text-zinc-300 ml-2">
              {line.slice(2)}
            </p>
          );
        }
        if (line.match(/^\[Link[^\]]*\]\(([^)]+)\)/)) {
          const match = line.match(/\[Link[^\]]*\]\(([^)]+)\)/);
          if (match) {
            return (
              <a
                key={i}
                href={match[1]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline ml-4 text-xs block"
              >
                View post
              </a>
            );
          }
        }
        if (line.trim()) {
          return (
            <p key={i} className="text-zinc-700 dark:text-zinc-300">
              {line}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}
