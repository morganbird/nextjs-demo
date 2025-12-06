"use client";

import { useEffect, useState, useCallback, useRef } from "react";

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
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleLogout = async () => {
    try {
      await fetch("/api/oauth/logout", { method: "POST" });
      setSession({ authenticated: false });
      setDropdownOpen(false);
    } catch {
      setSession({ authenticated: false });
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">...</div>
    );
  }

  if (session?.authenticated) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1 text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          <span>@{session.handle}</span>
          <svg
            className={`w-4 h-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-32 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800 z-10">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700 rounded-lg"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-72">
      <form onSubmit={handleLogin} className="flex gap-2">
        <input
          type="text"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder="handle.bsky.social"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-400"
          disabled={loginLoading}
        />
        <button
          type="submit"
          disabled={loginLoading || !handle.trim()}
          className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loginLoading ? "..." : "Sign in"}
        </button>
      </form>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
