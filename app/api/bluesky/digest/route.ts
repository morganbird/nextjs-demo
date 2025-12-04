import { BskyAgent } from "@atproto/api";
import { getAnthropicClient } from "@/app/lib/anthropic";

interface Post {
  uri: string;
  author: {
    handle: string;
    displayName?: string;
  };
  text: string;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  quotedPost?: {
    author: { handle?: string };
    text: string;
  } | null;
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

Output Format (use markdown):
## Overview
2-3 sentences summarizing the main themes/news of the day.

## Notable Posts
5-10 posts worth reading, each with:
- **@handle**: Brief description of why it's notable
- [Link to post](url)

## Trending Topics
Brief bullet points of recurring themes or active discussions.

Keep the entire digest readable in under 5 minutes.`;

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
      const postId = post.uri.split("/").pop();
      const postUrl = `https://bsky.app/profile/${post.author.handle}/post/${postId}`;

      return `[${i + 1}] @${post.author.handle} (${post.author.displayName || post.author.handle}) ${engagement}
"${post.text}"${quoted}
Link: ${postUrl}
---`;
    })
    .join("\n");

  return `Here are today's top ${posts.length} posts from my Bluesky feed, sorted by engagement:

${postsText}

Please create a daily digest following the format in your instructions.`;
}

export async function GET() {
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

    // Fetch timeline posts
    const timeline = await agent.getTimeline({ limit: 100 });

    // Extract and format posts
    const posts: Post[] = timeline.data.feed.map((item) => {
      const embed = item.post.embed;
      let quotedPost = null;

      if (embed?.$type === "app.bsky.embed.record#view") {
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

      if (embed?.$type === "app.bsky.embed.recordWithMedia#view") {
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
        },
        text: (item.post.record as { text?: string }).text || "",
        likeCount: item.post.likeCount ?? 0,
        repostCount: item.post.repostCount ?? 0,
        replyCount: item.post.replyCount ?? 0,
        quotedPost,
      };
    });

    // Sort by engagement and take top posts
    const topPosts = [...posts]
      .sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a))
      .slice(0, 100);

    // Generate digest with Claude (streaming)
    const anthropic = getAnthropicClient();
    const stream = await anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: DIGEST_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildDigestPrompt(topPosts) }],
    });

    // Return streaming response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Digest generation error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate digest" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
