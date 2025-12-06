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

  const handleLogout = async () => {
    try {
      await fetch("/api/oauth/logout", { method: "POST" });
      setSession({ authenticated: false });
      setDropdownOpen(false);
    } catch {
      setSession({ authenticated: false });
    }
  };

  // Don't render anything while loading or if not authenticated
  if (loading || !session?.authenticated) {
    return null;
  }

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
