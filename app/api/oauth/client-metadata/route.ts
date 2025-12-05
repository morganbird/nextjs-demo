import { getPublicKeyJwk } from "@/app/lib/oauth/client";

export async function GET(request: Request) {
  const publicKey = getPublicKeyJwk();
  if (!publicKey) {
    return new Response(JSON.stringify({ error: "OAuth not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const clientId = `${baseUrl}/api/oauth/client-metadata`;

  const metadata = {
    client_id: clientId,
    client_name: "Bluesky Daily Digest",
    client_uri: baseUrl,
    logo_uri: `${baseUrl}/icon.png`,
    redirect_uris: [`${baseUrl}/api/oauth/callback`],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: "atproto transition:generic",
    token_endpoint_auth_method: "private_key_jwt",
    token_endpoint_auth_signing_alg: "ES256",
    dpop_bound_access_tokens: true,
    jwks: {
      keys: [publicKey],
    },
  };

  return new Response(JSON.stringify(metadata), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
