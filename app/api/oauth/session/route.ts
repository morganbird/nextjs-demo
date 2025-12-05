import { cookies } from "next/headers";
import { getOAuthClient } from "@/app/lib/oauth/client";
import { Agent } from "@atproto/api";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionDid = cookieStore.get("bsky_session")?.value;

    if (!sessionDid) {
      return new Response(JSON.stringify({ authenticated: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Try to restore the session to verify it's still valid
    const client = await getOAuthClient();
    const session = await client.restore(sessionDid);

    if (!session) {
      // Session expired or invalid, clear cookie
      cookieStore.delete("bsky_session");
      return new Response(JSON.stringify({ authenticated: false }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch the user's profile to get their handle
    const agent = new Agent(session);
    const profile = await agent.getProfile({ actor: session.did });

    return new Response(
      JSON.stringify({
        authenticated: true,
        did: session.did,
        handle: profile.data.handle,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Session check error:", error);
    return new Response(JSON.stringify({ authenticated: false }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
