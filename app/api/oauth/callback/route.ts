import { getOAuthClient } from "@/app/lib/oauth/client";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = new URLSearchParams(url.search);

    const client = await getOAuthClient();
    const { session } = await client.callback(params);

    // Store the session DID in a cookie
    const cookieStore = await cookies();
    cookieStore.set("bsky_session", session.did, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    // Redirect to home page
    const baseUrl = `${url.protocol}//${url.host}`;
    return Response.redirect(baseUrl, 302);
  } catch (error) {
    console.error("OAuth callback error:", error);
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    return Response.redirect(`${baseUrl}?error=auth_failed`, 302);
  }
}
