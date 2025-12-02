import { BskyAgent } from "@atproto/api";
import { NextRequest, NextResponse } from "next/server";

const FEEDS = {
  timeline: null, // special case - uses getTimeline
  popular: "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot",
  "popular-friends": "at://did:plc:wqowuobffl66jv3kpsvo7ak4/app.bsky.feed.generator/the-algorithm",
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const feedType = searchParams.get("feed") || "timeline";

  const handle = process.env.BLUESKY_HANDLE;
  const appPassword = process.env.BLUESKY_APP_PASSWORD;

  if (!handle || !appPassword) {
    return NextResponse.json(
      { error: "Missing Bluesky credentials" },
      { status: 500 }
    );
  }

  try {
    const agent = new BskyAgent({ service: "https://bsky.social" });

    await agent.login({
      identifier: handle,
      password: appPassword,
    });

    let feedData;
    if (feedType === "timeline") {
      feedData = await agent.getTimeline({ limit: 50 });
    } else {
      const feedUri = FEEDS[feedType as keyof typeof FEEDS];
      if (!feedUri) {
        return NextResponse.json({ error: "Unknown feed" }, { status: 400 });
      }
      feedData = await agent.app.bsky.feed.getFeed({ feed: feedUri, limit: 50 });
    }

    const posts = feedData.data.feed.map((item) => {
      const embed = item.post.embed;
      let quotedPost = null;

      // Check for quoted post in embed
      if (embed?.$type === "app.bsky.embed.record#view") {
        const record = (embed as { record?: { $type?: string; author?: { handle: string; displayName?: string; avatar?: string }; value?: { text?: string }; uri?: string } }).record;
        if (record?.$type === "app.bsky.embed.record#viewRecord") {
          quotedPost = {
            uri: record.uri,
            author: {
              handle: record.author?.handle,
              displayName: record.author?.displayName,
              avatar: record.author?.avatar,
            },
            text: (record.value as { text?: string })?.text || "",
          };
        }
      }

      // Also check recordWithMedia (quote post with images/video)
      if (embed?.$type === "app.bsky.embed.recordWithMedia#view") {
        const recordEmbed = (embed as { record?: { record?: { $type?: string; author?: { handle: string; displayName?: string; avatar?: string }; value?: { text?: string }; uri?: string } } }).record;
        const record = recordEmbed?.record;
        if (record?.$type === "app.bsky.embed.record#viewRecord") {
          quotedPost = {
            uri: record.uri,
            author: {
              handle: record.author?.handle,
              displayName: record.author?.displayName,
              avatar: record.author?.avatar,
            },
            text: (record.value as { text?: string })?.text || "",
          };
        }
      }

      return {
        uri: item.post.uri,
        cid: item.post.cid,
        author: {
          handle: item.post.author.handle,
          displayName: item.post.author.displayName,
          avatar: item.post.author.avatar,
        },
        text: (item.post.record as { text?: string }).text || "",
        createdAt: (item.post.record as { createdAt?: string }).createdAt,
        likeCount: item.post.likeCount,
        repostCount: item.post.repostCount,
        replyCount: item.post.replyCount,
        quotedPost,
      };
    });

    return NextResponse.json({ posts });
  } catch (error) {
    console.error("Bluesky API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}
