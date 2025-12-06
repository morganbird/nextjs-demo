"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import LoginForm from "./LoginForm";

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

interface QuotedPost {
  author: { handle?: string; displayName?: string; avatar?: string };
  text: string;
}

interface Post {
  uri: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  quotedPost?: QuotedPost | null;
}

interface NotablePost {
  post: Post;
  reason: string;
}

interface DigestMeta {
  totalPosts: number;
  postsAnalyzed: number;
  newestPostDate: string | null;
  oldestPostDate: string | null;
  generatedAt: string;
  digestType?: "general" | "ai";
  keywordMatches?: number;
  feedPostCount?: number;
}

interface DigestData {
  overview: string;
  notablePosts: NotablePost[];
  trendingTopics: string[];
  meta: DigestMeta;
  cached?: boolean;
}

type DigestType = "general" | "ai";

const DIGEST_TABS = [
  { id: "general" as DigestType, label: "General" },
  { id: "ai" as DigestType, label: "AI & ML" },
] as const;

export default function Digest() {
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [selectedTab, setSelectedTab] = useState<DigestType>("general");

  const fetchDigest = useCallback(async (type: DigestType, refresh = false) => {
    setLoading(true);
    setError(null);
    setNeedsAuth(false);

    try {
      const params = new URLSearchParams({ type });
      if (refresh) params.set("refresh", "true");
      const url = `/api/bluesky/digest?${params.toString()}`;
      const response = await fetch(url);

      const data = await response.json();

      if (!response.ok) {
        if (data.needsAuth) {
          setNeedsAuth(true);
          return;
        }
        throw new Error(data.error || "Failed to generate digest");
      }

      setDigest(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDigest(selectedTab);
  }, [fetchDigest, selectedTab]);

  if (needsAuth) {
    return (
      <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          Sign in with Bluesky
        </h2>
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {/* Tab switcher and refresh on same row */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          {DIGEST_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              disabled={loading}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                selectedTab === tab.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => fetchDigest(selectedTab, true)}
          disabled={loading}
          className="rounded-full px-3 py-1.5 text-sm font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          {loading ? "Generating..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          Error: {error}
        </div>
      ) : loading ? (
        <div className="text-zinc-500 dark:text-zinc-400">
          Generating your daily digest...
        </div>
      ) : digest ? (
        <div className="space-y-6">
          {/* Meta info */}
          {digest.meta && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {digest.meta.keywordMatches !== undefined ? (
                <>
                  Found {digest.meta.keywordMatches} AI posts from timeline
                  {digest.meta.feedPostCount !== undefined && digest.meta.feedPostCount > 0 && (
                    <> + {digest.meta.feedPostCount} from ML feeds</>
                  )}
                  , analyzed top {digest.meta.postsAnalyzed}
                </>
              ) : (
                <>Analyzed {digest.meta.postsAnalyzed} of {digest.meta.totalPosts} posts</>
              )}
              {digest.meta.oldestPostDate && digest.meta.newestPostDate && (
                <> from {formatRelativeTime(digest.meta.oldestPostDate)} to {formatRelativeTime(digest.meta.newestPostDate)}</>
              )}
              {digest.cached && (
                <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                  · cached {formatRelativeTime(digest.meta.generatedAt)}
                </span>
              )}
            </p>
          )}

          {/* Overview */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              Overview
            </h3>
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {digest.overview}
            </p>
          </div>

          {/* Notable Posts */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              Notable Posts
            </h3>
            <div className="space-y-4">
              {digest.notablePosts.map((notable, index) => (
                <div key={notable.post.uri || index} className="space-y-2">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                    {notable.reason}
                  </p>
                  <EmbeddedPost post={notable.post} />
                </div>
              ))}
            </div>
          </div>

          {/* Trending Topics */}
          {digest.trendingTopics && digest.trendingTopics.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                Trending Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {digest.trendingTopics.map((topic, index) => (
                  <span
                    key={index}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function EmbeddedPost({ post }: { post: Post }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const postId = post.uri.split("/").pop();
  const postUrl = `https://bsky.app/profile/${post.author.handle}/post/${postId}`;

  useEffect(() => {
    // Load Bluesky embed script if not already loaded
    if (!document.querySelector('script[src="https://embed.bsky.app/static/embed.js"]')) {
      const script = document.createElement("script");
      script.src = "https://embed.bsky.app/static/embed.js";
      script.async = true;
      script.charset = "utf-8";
      document.body.appendChild(script);
    } else {
      // Script already loaded, scan for new embeds
      (window as unknown as { bluesky?: { scan?: () => void } }).bluesky?.scan?.();
    }
  }, [post.uri]);

  return (
    <div ref={containerRef}>
      <blockquote
        className="bluesky-embed"
        data-bluesky-uri={post.uri}
        data-bluesky-cid=""
      >
        <p lang="en">
          {post.text}
        </p>
        &mdash; {post.author.displayName || post.author.handle} (
        <a href={`https://bsky.app/profile/${post.author.handle}`}>@{post.author.handle}</a>)
        {" "}
        <a href={postUrl}>View post</a>
      </blockquote>
    </div>
  );
}
