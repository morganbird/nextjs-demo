import { getOAuthClient } from "@/app/lib/oauth/client";

export async function POST(request: Request) {
  try {
    const { handle } = await request.json();

    if (!handle || typeof handle !== "string") {
      return new Response(JSON.stringify({ error: "Handle is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = await getOAuthClient();
    const url = await client.authorize(handle, {
      scope: "atproto transition:generic",
    });

    return new Response(JSON.stringify({ url: url.toString() }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("OAuth login error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to initiate login" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
