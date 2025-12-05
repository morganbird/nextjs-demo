"use client";

import { useEffect, useState, useCallback } from "react";

interface Session {
  authenticated: boolean;
  did?: string;
  handle?: string;
}

export default function Auth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/oauth/session");
      const data = await response.json();
      setSession(data);
    } catch {
      setSession({ authenticated: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

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

      // Redirect to Bluesky authorization
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/oauth/logout", { method: "POST" });
      setSession({ authenticated: false });
    } catch {
      // Still clear local state even if server fails
      setSession({ authenticated: false });
    }
  };

  if (loading) {
    return (
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (session?.authenticated) {
    return (
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-700 dark:text-zinc-300">
              Signed in as{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                @{session.handle}
              </span>
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-full px-3 py-1 text-sm font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
        Sign in with Bluesky
      </h2>
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
    </div>
  );
}
