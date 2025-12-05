import { cookies } from "next/headers";
import { kv } from "@vercel/kv";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionDid = cookieStore.get("bsky_session")?.value;

    // Clear the OAuth session from KV if it exists
    if (sessionDid) {
      await kv.del(`oauth:session:${sessionDid}`);
    }

    // Clear the session cookie
    cookieStore.delete("bsky_session");

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Logout error:", error);
    return new Response(JSON.stringify({ error: "Logout failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
