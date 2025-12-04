"use client";

import { useEffect, useState, useCallback } from "react";

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
}

interface DigestData {
  overview: string;
  notablePosts: NotablePost[];
  trendingTopics: string[];
  meta: DigestMeta;
  cached?: boolean;
}

export default function Digest() {
  const [digest, setDigest] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDigest = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const url = refresh ? "/api/bluesky/digest?refresh=true" : "/api/bluesky/digest";
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate digest");
      }

      const data = await response.json();
      setDigest(data);
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
          onClick={() => fetchDigest(true)}
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
      ) : loading ? (
        <div className="text-zinc-500 dark:text-zinc-400">
          Generating your daily digest...
        </div>
      ) : digest ? (
        <div className="space-y-6">
          {/* Meta info */}
          {digest.meta && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Analyzed {digest.meta.postsAnalyzed} of {digest.meta.totalPosts} posts
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
  const postId = post.uri.split("/").pop();
  const postUrl = `https://bsky.app/profile/${post.author.handle}/post/${postId}`;

  return (
    <a
      href={postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg border border-zinc-200 bg-zinc-50 p-3 hover:bg-zinc-100 transition-colors dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750"
    >
      <div className="flex items-start gap-3">
        {post.author.avatar ? (
          <img
            src={post.author.avatar}
            alt={post.author.handle}
            className="h-8 w-8 rounded-full"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {post.author.handle[0].toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {post.author.displayName || post.author.handle}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              @{post.author.handle}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap line-clamp-4">
            {post.text}
          </p>
          {post.quotedPost && (
            <div className="mt-2 rounded border border-zinc-200 bg-white p-2 dark:border-zinc-600 dark:bg-zinc-700">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {post.quotedPost.author.displayName || post.quotedPost.author.handle}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  @{post.quotedPost.author.handle}
                </span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2">
                {post.quotedPost.text}
              </p>
            </div>
          )}
          <div className="mt-2 flex gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{post.replyCount} replies</span>
            <span>{post.repostCount} reposts</span>
            <span>{post.likeCount} likes</span>
          </div>
        </div>
      </div>
    </a>
  );
}
