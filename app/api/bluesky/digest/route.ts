import { BskyAgent } from "@atproto/api";
import { getAnthropicClient } from "@/app/lib/anthropic";
import { promises as fs } from "fs";
import path from "path";

interface Post {
  uri: string;
  author: {
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  text: string;
  createdAt: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  quotedPost?: {
    author: { handle?: string; displayName?: string; avatar?: string };
    text: string;
  } | null;
}

interface DigestCache {
  digest: {
    overview: string;
    notablePosts: Array<{ post: Post; reason: string }>;
    trendingTopics: string[];
    meta: {
      totalPosts: number;
      postsAnalyzed: number;
      oldestPostDate: string | null;
      generatedAt: string;
    };
  };
  date: string;
}

const CACHE_DIR = path.join(process.cwd(), ".cache");
const CACHE_FILE = path.join(CACHE_DIR, "digest.json");

async function getCache(): Promise<DigestCache | null> {
  try {
    const data = await fs.readFile(CACHE_FILE, "utf-8");
    const cache: DigestCache = JSON.parse(data);
    // Check if cache is from today
    const today = new Date().toISOString().split("T")[0];
    if (cache.date === today) {
      return cache;
    }
    return null;
  } catch {
    return null;
  }
}

async function setCache(digest: DigestCache["digest"]): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const cache: DigestCache = {
      digest,
      date: new Date().toISOString().split("T")[0],
    };
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error("Failed to write cache:", error);
  }
}

const DIGEST_SYSTEM_PROMPT = `You are a skilled social media analyst creating a daily digest of Bluesky posts. Your goal is to help the reader understand what happened today in their feed without reading every post.

Guidelines:
- Synthesize themes, don't just list posts
- Be concise but insightful
- Highlight why something matters, not just what was said
- For notable posts, explain their significance in 1-2 sentences
- Recognize when multiple posts discuss the same topic and group them
- Note emerging conversations or debates
- Be neutral in tone but can note sentiment trends

You MUST respond with valid JSON in this exact format:
{
  "overview": "2-3 sentences summarizing the main themes/news of the day.",
  "notablePosts": [
    {
      "postIndex": 1,
      "reason": "Brief explanation of why this post is notable (1-2 sentences)"
    }
  ],
  "trendingTopics": ["topic 1", "topic 2", "topic 3"]
}

Rules:
- postIndex refers to the [number] at the start of each post in the input
- Select 5-10 notable posts
- Keep reasons concise but insightful
- Respond with ONLY the JSON, no other text`;

function calculateEngagementScore(post: Post): number {
  return post.likeCount + post.repostCount * 2 + post.replyCount * 1.5;
}

function buildDigestPrompt(posts: Post[]): string {
  const postsText = posts
    .map((post, i) => {
      const engagement = `[${post.likeCount} likes, ${post.repostCount} reposts, ${post.replyCount} replies]`;
      const quoted = post.quotedPost
        ? `\n  > Quoting @${post.quotedPost.author.handle}: "${post.quotedPost.text.slice(0, 200)}${post.quotedPost.text.length > 200 ? "..." : ""}"`
        : "";

      return `[${i + 1}] @${post.author.handle} (${post.author.displayName || post.author.handle}) ${engagement}
"${post.text}"${quoted}
---`;
    })
    .join("\n");

  return `Here are today's top ${posts.length} posts from my Bluesky feed, sorted by engagement:

${postsText}

Analyze these posts and create a daily digest as JSON.`;
}

function extractPost(item: { post: { uri: string; author: { handle: string; displayName?: string; avatar?: string }; embed?: unknown; record: unknown; likeCount?: number; repostCount?: number; replyCount?: number } }): Post {
  const embed = item.post.embed;
  let quotedPost = null;

  if ((embed as { $type?: string })?.$type === "app.bsky.embed.record#view") {
    const record = (
      embed as {
        record?: {
          $type?: string;
          author?: { handle: string };
          value?: { text?: string };
        };
      }
    ).record;
    if (record?.$type === "app.bsky.embed.record#viewRecord") {
      quotedPost = {
        author: { handle: record.author?.handle },
        text: (record.value as { text?: string })?.text || "",
      };
    }
  }

  if ((embed as { $type?: string })?.$type === "app.bsky.embed.recordWithMedia#view") {
    const recordEmbed = (
      embed as {
        record?: {
          record?: {
            $type?: string;
            author?: { handle: string };
            value?: { text?: string };
          };
        };
      }
    ).record;
    const record = recordEmbed?.record;
    if (record?.$type === "app.bsky.embed.record#viewRecord") {
      quotedPost = {
        author: { handle: record.author?.handle },
        text: (record.value as { text?: string })?.text || "",
      };
    }
  }

  return {
    uri: item.post.uri,
    author: {
      handle: item.post.author.handle,
      displayName: item.post.author.displayName,
      avatar: item.post.author.avatar,
    },
    text: (item.post.record as { text?: string }).text || "",
    createdAt: (item.post.record as { createdAt?: string }).createdAt || "",
    likeCount: item.post.likeCount ?? 0,
    repostCount: item.post.repostCount ?? 0,
    replyCount: item.post.replyCount ?? 0,
    quotedPost,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "true";

  // Check cache first (unless refresh requested)
  if (!refresh) {
    const cached = await getCache();
    if (cached) {
      return new Response(
        JSON.stringify({ ...cached.digest, cached: true }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const handle = process.env.BLUESKY_HANDLE;
  const appPassword = process.env.BLUESKY_APP_PASSWORD;

  if (!handle || !appPassword) {
    return new Response(JSON.stringify({ error: "Missing Bluesky credentials" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing Anthropic API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Authenticate with Bluesky
    const agent = new BskyAgent({ service: "https://bsky.social" });
    await agent.login({ identifier: handle, password: appPassword });

    // Fetch posts with pagination
    // Note: Feed isn't strictly chronological (reposts, algorithm), so we fetch
    // multiple pages and filter by date afterward
    const allPosts: Post[] = [];
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let cursor: string | undefined;
    let oldPostCount = 0;
    const MAX_OLD_POSTS = 20; // Stop after seeing this many old posts in a row

    while (true) {
      const timeline = await agent.getTimeline({ limit: 100, cursor });

      if (timeline.data.feed.length === 0) {
        break;
      }

      for (const item of timeline.data.feed) {
        const post = extractPost(item);
        const postDate = new Date(post.createdAt);

        if (postDate < twentyFourHoursAgo) {
          oldPostCount++;
        } else {
          oldPostCount = 0; // Reset counter when we see a recent post
          allPosts.push(post);
        }
      }

      cursor = timeline.data.cursor;

      // Stop if we've seen many old posts in a row, or hit safety limits
      if (oldPostCount >= MAX_OLD_POSTS || !cursor || allPosts.length > 1000) {
        break;
      }
    }

    // Deduplicate by URI (same post can appear multiple times)
    const seen = new Set<string>();
    const posts = allPosts.filter((post) => {
      if (seen.has(post.uri)) return false;
      seen.add(post.uri);
      return true;
    });

    // Find date range of posts
    const postsWithDates = posts.filter((p) => p.createdAt);
    const oldestPost = postsWithDates.length > 0
      ? postsWithDates.reduce((oldest, post) =>
          new Date(post.createdAt) < new Date(oldest.createdAt) ? post : oldest
        )
      : null;
    const newestPost = postsWithDates.length > 0
      ? postsWithDates.reduce((newest, post) =>
          new Date(post.createdAt) > new Date(newest.createdAt) ? post : newest
        )
      : null;

    // Sort by engagement and take top posts for summarization
    const topPosts = [...posts]
      .sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a))
      .slice(0, 150);

    // Generate digest with Claude
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: DIGEST_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildDigestPrompt(topPosts) }],
    });

    // Extract text response
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse Claude's JSON response (strip markdown code fences if present)
    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    const digestData = JSON.parse(jsonText);

    // Map post indices to actual posts with full data
    const notablePostsWithData = digestData.notablePosts.map(
      (notable: { postIndex: number; reason: string }) => {
        const post = topPosts[notable.postIndex - 1]; // postIndex is 1-based
        return {
          post: post
            ? {
                uri: post.uri,
                author: post.author,
                text: post.text,
                likeCount: post.likeCount,
                repostCount: post.repostCount,
                replyCount: post.replyCount,
                quotedPost: post.quotedPost,
              }
            : null,
          reason: notable.reason,
        };
      }
    ).filter((p: { post: Post | null }) => p.post !== null);

    const digest = {
      overview: digestData.overview,
      notablePosts: notablePostsWithData,
      trendingTopics: digestData.trendingTopics,
      meta: {
        totalPosts: posts.length,
        postsAnalyzed: topPosts.length,
        newestPostDate: newestPost?.createdAt || null,
        oldestPostDate: oldestPost?.createdAt || null,
        generatedAt: new Date().toISOString(),
      },
    };

    // Cache the result
    await setCache(digest);

    return new Response(
      JSON.stringify({ ...digest, cached: false }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Digest generation error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate digest" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
