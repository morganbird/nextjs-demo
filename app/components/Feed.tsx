"use client";

import { useEffect, useState } from "react";

interface QuotedPost {
  uri?: string;
  author: {
    handle?: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
}

interface Post {
  uri: string;
  cid: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
  createdAt: string;
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  quotedPost?: QuotedPost | null;
}

const FEED_OPTIONS = [
  { id: "timeline", label: "Following" },
  { id: "popular-friends", label: "Popular with Friends" },
] as const;

type FeedType = (typeof FEED_OPTIONS)[number]["id"];

export default function Feed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<FeedType>("timeline");

  useEffect(() => {
    async function fetchFeed() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/bluesky/feed?feed=${selectedFeed}`);
        if (!response.ok) {
          throw new Error("Failed to fetch feed");
        }
        const data = await response.json();
        setPosts(data.posts);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchFeed();
  }, [selectedFeed]);

  const feedSwitcher = (
    <div className="mb-4 flex gap-2">
      {FEED_OPTIONS.map((feed) => (
        <button
          key={feed.id}
          onClick={() => setSelectedFeed(feed.id)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            selectedFeed === feed.id
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          }`}
        >
          {feed.label}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <>
        {feedSwitcher}
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-500 dark:text-zinc-400">Loading feed...</div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {feedSwitcher}
        <div className="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
          Error: {error}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {feedSwitcher}
      {posts.map((post) => (
        <article
          key={post.uri}
          className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="flex items-start gap-3">
            {post.author.avatar ? (
              <img
                src={post.author.avatar}
                alt={post.author.handle}
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
                <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  {post.author.handle[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {post.author.displayName || post.author.handle}
                </span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  @{post.author.handle}
                </span>
              </div>
              <p className="mt-1 text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                {post.text}
              </p>
              {post.quotedPost && (
                <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
                  <div className="flex items-center gap-2 mb-1">
                    {post.quotedPost.author.avatar ? (
                      <img
                        src={post.quotedPost.author.avatar}
                        alt={post.quotedPost.author.handle || ""}
                        className="h-5 w-5 rounded-full"
                      />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-300 dark:bg-zinc-600">
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          {post.quotedPost.author.handle?.[0]?.toUpperCase() || "?"}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      {post.quotedPost.author.displayName || post.quotedPost.author.handle}
                    </span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      @{post.quotedPost.author.handle}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {post.quotedPost.text}
                  </p>
                </div>
              )}
              <div className="mt-3 flex gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                <span>{post.replyCount ?? 0} replies</span>
                <span>{post.repostCount ?? 0} reposts</span>
                <span>{post.likeCount ?? 0} likes</span>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
