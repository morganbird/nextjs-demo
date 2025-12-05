import { Agent } from "@atproto/api";
import { getAnthropicClient } from "@/app/lib/anthropic";
import { kv } from "@vercel/kv";
import { cookies } from "next/headers";
import { getOAuthClient } from "@/app/lib/oauth/client";

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

type DigestType = "general" | "ai";

function getCacheKey(type: DigestType): string {
  const today = new Date().toISOString().split("T")[0];
  return `digest:${type}:${today}`;
}

async function getCache(type: DigestType): Promise<DigestCache | null> {
  try {
    const cache = await kv.get<DigestCache>(getCacheKey(type));
    return cache;
  } catch (error) {
    console.error("Failed to read cache:", error);
    return null;
  }
}

async function setCache(type: DigestType, digest: DigestCache["digest"]): Promise<void> {
  try {
    const cache: DigestCache = {
      digest,
      date: new Date().toISOString().split("T")[0],
    };
    // Cache expires after 24 hours
    await kv.set(getCacheKey(type), cache, { ex: 86400 });
  } catch (error) {
    console.error("Failed to write cache:", error);
  }
}

// AI/ML related keywords for filtering
const AI_KEYWORDS = [
  "\\bai\\b", "artificial intelligence", "machine learning", "\\bml\\b", "deep learning",
  "\\bllm\\b", "large language model", "\\bgpt\\b", "claude", "chatgpt", "gemini", "\\bllama\\b",
  "neural network", "transformer", "diffusion", "stable diffusion", "midjourney",
  "openai", "anthropic", "deepmind", "hugging face", "huggingface",
  "\\bagi\\b", "alignment", "\\brlhf\\b", "fine-tuning", "finetuning", "embeddings", "\\brag\\b", "vector",
  "prompt engineering", "inference", "\\bmodel weights\\b", "foundation model",
  "generative ai", "gen ai", "genai", "copilot", "\\bgrok\\b", "perplexity", "\\bmistral\\b",
  "baguettotron", "context window", "arxiv", "model", "train"
];

const AI_KEYWORDS_REGEX = new RegExp(AI_KEYWORDS.join("|"), "i");

function isAIRelated(post: Post): boolean {
  const textToCheck = post.text + (post.quotedPost?.text || "");
  return AI_KEYWORDS_REGEX.test(textToCheck);
}

// External AI/ML feeds to include in the AI digest
const AI_FEEDS = [
  { handle: "smcgrath.phd", rkey: "MLBlend" },
];

async function fetchAIFeedPosts(
  agent: Agent,
  twentyFourHoursAgo: Date
): Promise<Post[]> {
  const allPosts: Post[] = [];

  for (const feed of AI_FEEDS) {
    try {
      // Resolve handle to DID
      const profile = await agent.getProfile({ actor: feed.handle });
      const did = profile.data.did;
      const feedUri = `at://${did}/app.bsky.feed.generator/${feed.rkey}`;

      // Fetch from the feed with pagination
      let cursor: string | undefined;
      let oldPostCount = 0;
      const MAX_OLD_POSTS = 10;

      while (true) {
        const feedData = await agent.app.bsky.feed.getFeed({
          feed: feedUri,
          limit: 100,
          cursor,
        });

        if (feedData.data.feed.length === 0) break;

        for (const item of feedData.data.feed) {
          const post = extractPost(item);
          const postDate = new Date(post.createdAt);

          if (postDate < twentyFourHoursAgo) {
            oldPostCount++;
          } else {
            oldPostCount = 0;
            allPosts.push(post);
          }
        }

        cursor = feedData.data.cursor;
        if (oldPostCount >= MAX_OLD_POSTS || !cursor || allPosts.length > 500) {
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch feed ${feed.handle}/${feed.rkey}:`, error);
    }
  }

  return allPosts;
}

const DIGEST_SYSTEM_PROMPT_GENERAL = `You are a skilled social media analyst creating a daily digest of Bluesky posts. Your goal is to help the reader understand what happened today in their feed without reading every post.

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

const DIGEST_SYSTEM_PROMPT_AI = `You are an AI/ML specialist creating a daily digest of AI-related Bluesky posts. Your goal is to help the reader stay current on AI developments without reading every post.

These posts were pre-filtered by keywords, so some may be false positives (mentioning AI tangentially). Focus on posts that are substantively about AI/ML.

Guidelines:
- Focus ONLY on posts genuinely about AI, machine learning, LLMs, or related technology
- Ignore posts that mention AI tangentially or aren't really about AI
- Group by sub-topics: new models/releases, research, products/tools, industry news, ethics/safety, tutorials/tips
- Highlight significant announcements, insights, or discussions
- Note emerging debates or trends in the AI community

You MUST respond with valid JSON in this exact format:
{
  "overview": "2-3 sentences summarizing the main AI/ML themes and news of the day.",
  "notablePosts": [
    {
      "postIndex": 1,
      "reason": "Brief explanation of why this AI post is notable (1-2 sentences)"
    }
  ],
  "trendingTopics": ["AI topic 1", "AI topic 2", "AI topic 3"]
}

Rules:
- postIndex refers to the [number] at the start of each post in the input
- Select 5-10 notable posts that are GENUINELY about AI/ML
- Exclude false positives (posts not really about AI)
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
  const digestType: DigestType = url.searchParams.get("type") === "ai" ? "ai" : "general";

  // Check cache first (unless refresh requested)
  if (!refresh) {
    const cached = await getCache(digestType);
    if (cached) {
      return new Response(
        JSON.stringify({ ...cached.digest, digestType, cached: true }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: "Missing Anthropic API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check for OAuth session
  const cookieStore = await cookies();
  const sessionDid = cookieStore.get("bsky_session")?.value;

  if (!sessionDid) {
    return new Response(JSON.stringify({ error: "Not authenticated", needsAuth: true }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Restore OAuth session and create agent
    const oauthClient = await getOAuthClient();
    const oauthSession = await oauthClient.restore(sessionDid);

    if (!oauthSession) {
      cookieStore.delete("bsky_session");
      return new Response(JSON.stringify({ error: "Session expired", needsAuth: true }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const agent = new Agent(oauthSession);

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

    // Select posts based on digest type
    let postsForDigest: Post[];
    let keywordMatches: number | undefined;
    let feedPostCount: number | undefined;

    if (digestType === "ai") {
      // For AI digest: combine keyword-matched timeline posts with AI feed posts
      const aiTimelinePosts = posts.filter(isAIRelated);
      keywordMatches = aiTimelinePosts.length;

      // Fetch posts from external AI feeds
      const aiFeedPosts = await fetchAIFeedPosts(agent, twentyFourHoursAgo);
      feedPostCount = aiFeedPosts.length;

      // Merge and deduplicate
      const allAIPosts = [...aiTimelinePosts, ...aiFeedPosts];
      const seenUris = new Set<string>();
      const uniqueAIPosts = allAIPosts.filter((post) => {
        if (seenUris.has(post.uri)) return false;
        seenUris.add(post.uri);
        return true;
      });

      postsForDigest = [...uniqueAIPosts]
        .sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a))
        .slice(0, 150);
    } else {
      // For general digest: top 150 by engagement
      postsForDigest = [...posts]
        .sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a))
        .slice(0, 150);
    }

    // Select appropriate system prompt
    const systemPrompt = digestType === "ai"
      ? DIGEST_SYSTEM_PROMPT_AI
      : DIGEST_SYSTEM_PROMPT_GENERAL;

    // Generate digest with Claude
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: buildDigestPrompt(postsForDigest) }],
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
        const post = postsForDigest[notable.postIndex - 1]; // postIndex is 1-based
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
        postsAnalyzed: postsForDigest.length,
        newestPostDate: newestPost?.createdAt || null,
        oldestPostDate: oldestPost?.createdAt || null,
        generatedAt: new Date().toISOString(),
        digestType,
        ...(keywordMatches !== undefined && { keywordMatches }),
        ...(feedPostCount !== undefined && { feedPostCount }),
      },
    };

    // Cache the result
    await setCache(digestType, digest);

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
