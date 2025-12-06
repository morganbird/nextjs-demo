"use client";

import { useState } from "react";

export default function LoginForm() {
  const [loginLoading, setLoginLoading] = useState(false);
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;

    setLoginLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/oauth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: handle.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoginLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-3">
      <div>
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="Enter your handle (e.g., alice.bsky.social)"
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          disabled={loginLoading}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      <button
        type="submit"
        disabled={loginLoading || !handle.trim()}
        className="w-full rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loginLoading ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
